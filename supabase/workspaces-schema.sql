-- =============================================================
-- Vestline: Shared Workspaces + Grant Share Links
-- Idempotent — safe to re-run; drops existing objects first.
-- =============================================================

-- ── Drop policies ─────────────────────────────────────────────
drop policy if exists "ws_select"  on public.workspaces;
drop policy if exists "ws_insert"  on public.workspaces;
drop policy if exists "ws_update"  on public.workspaces;
drop policy if exists "wm_select"  on public.workspace_members;
drop policy if exists "wm_insert"  on public.workspace_members;
drop policy if exists "wi_select"  on public.workspace_invites;
drop policy if exists "wi_insert"  on public.workspace_invites;
drop policy if exists "gsl_select" on public.grant_share_links;
drop policy if exists "gsl_insert" on public.grant_share_links;
drop policy if exists "gsl_delete" on public.grant_share_links;

-- ── Drop helper functions (recreated below) ───────────────────
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.is_workspace_editor(uuid);

-- ── 1. Shared workspaces ──────────────────────────────────────
create table if not exists public.workspaces (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null default 'Shared workspace',
  owner_id    text        not null,
  payload     jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- ── 2. Workspace membership ───────────────────────────────────
create table if not exists public.workspace_members (
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  user_id      text        not null,
  role         text        not null default 'editor'
                           check (role in ('owner', 'editor')),
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

-- ── 3. Invite tokens ─────────────────────────────────────────
create table if not exists public.workspace_invites (
  token        uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  created_by   text        not null,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now()
);

alter table public.workspace_invites enable row level security;

-- ── 4. Grant share links (employee read-only, no auth needed) ─
create table if not exists public.grant_share_links (
  token          uuid        primary key default gen_random_uuid(),
  user_id        text        not null,   -- vestline_app_data.user_id of the workspace owner
  stakeholder_id text        not null,
  created_at     timestamptz not null default now(),
  unique (user_id, stakeholder_id)       -- one stable link per person
);

alter table public.grant_share_links enable row level security;


-- =============================================================
-- MEMBERSHIP HELPER (security definer — bypasses RLS to avoid
-- infinite recursion in workspace_members policies)
-- =============================================================

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.jwt() ->> 'sub')
  );
$$;

create or replace function public.is_workspace_editor(p_workspace_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = (select auth.jwt() ->> 'sub')
      and role in ('owner', 'editor')
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_editor(uuid)  to authenticated;

-- =============================================================
-- RLS POLICIES
-- =============================================================

-- workspaces: members can read; editors can update payload
create policy "ws_select"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id));

create policy "ws_insert"
  on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.jwt() ->> 'sub'));

create policy "ws_update"
  on public.workspaces for update to authenticated
  using (public.is_workspace_editor(id))
  with check (true);

-- workspace_members: each user can always see their own rows (no self-reference);
-- seeing co-members is handled via the security definer helper.
create policy "wm_select"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "wm_insert"
  on public.workspace_members for insert to authenticated
  with check (
    -- self-insert only (invite acceptance handled by the RPC)
    user_id = (select auth.jwt() ->> 'sub')
  );

-- workspace_invites: members can read + insert for their workspaces
create policy "wi_select"
  on public.workspace_invites for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "wi_insert"
  on public.workspace_invites for insert to authenticated
  with check (
    created_by = (select auth.jwt() ->> 'sub')
    and public.is_workspace_member(workspace_id)
  );

-- grant_share_links: public read (token is the secret); owner manages own links
create policy "gsl_select"
  on public.grant_share_links for select
  to anon, authenticated
  using (true);

create policy "gsl_insert"
  on public.grant_share_links for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));

create policy "gsl_delete"
  on public.grant_share_links for delete to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));


-- =============================================================
-- RPC FUNCTIONS (security definer — bypass RLS)
-- =============================================================

-- Create a workspace and auto-enroll the caller as owner
create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id    text := (select auth.jwt() ->> 'sub');
  v_ws_id      uuid;
  v_default    jsonb;
begin
  -- Seed the workspace payload with company name matching the workspace name
  v_default := jsonb_build_object(
    'company',      jsonb_build_object('name', p_name),
    'stakeholders', '[]'::jsonb,
    'grants',       '[]'::jsonb
  );

  insert into public.workspaces (name, owner_id, payload)
  values (p_name, v_user_id, v_default)
  returning id into v_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws_id, v_user_id, 'owner');

  return v_ws_id;
end;
$$;

-- Generate a 7-day invite token for a workspace
create or replace function public.create_workspace_invite(p_workspace_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id text := (select auth.jwt() ->> 'sub');
  v_token   uuid;
begin
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = v_user_id
  ) then
    raise exception 'Not a member of this workspace';
  end if;

  insert into public.workspace_invites (workspace_id, created_by)
  values (p_workspace_id, v_user_id)
  returning token into v_token;

  return v_token;
end;
$$;

-- Accept an invite: validate token → insert member row
create or replace function public.join_workspace_via_invite(p_token uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id        text := (select auth.jwt() ->> 'sub');
  v_workspace_id   uuid;
  v_workspace_name text;
  v_expires_at     timestamptz;
begin
  select wi.workspace_id, wi.expires_at, w.name
    into v_workspace_id, v_expires_at, v_workspace_name
  from public.workspace_invites wi
  join public.workspaces w on w.id = wi.workspace_id
  where wi.token = p_token;

  if v_workspace_id is null then
    return json_build_object('error', 'Invalid invite link');
  end if;

  if v_expires_at < now() then
    return json_build_object('error', 'This invite link has expired');
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'editor')
  on conflict (workspace_id, user_id) do nothing;

  return json_build_object(
    'workspace_id',   v_workspace_id,
    'workspace_name', v_workspace_name
  );
end;
$$;

-- Create (or reuse) a read-only grant share link for one stakeholder
create or replace function public.create_grant_share_link(p_stakeholder_id text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id text := (select auth.jwt() ->> 'sub');
  v_token   uuid;
begin
  insert into public.grant_share_links (user_id, stakeholder_id)
  values (v_user_id, p_stakeholder_id)
  on conflict (user_id, stakeholder_id) do update
    set created_at = now()          -- touch timestamp so it stays fresh
  returning token into v_token;

  return v_token;
end;
$$;

-- Fetch only the linked stakeholder's data — no other team members exposed
create or replace function public.get_grant_by_share_token(p_token uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id        text;
  v_stakeholder_id text;
  v_payload        jsonb;
  v_stakeholder    jsonb;
  v_grants         jsonb;
begin
  select user_id, stakeholder_id
    into v_user_id, v_stakeholder_id
  from public.grant_share_links
  where token = p_token;

  if v_user_id is null then
    return null;
  end if;

  select payload into v_payload
  from public.vestline_app_data
  where user_id = v_user_id;

  if v_payload is null then
    return null;
  end if;

  -- Filter: only the linked stakeholder's record
  select elem into v_stakeholder
  from jsonb_array_elements(v_payload -> 'stakeholders') elem
  where elem ->> 'id' = v_stakeholder_id
  limit 1;

  -- Filter: only grants belonging to this stakeholder
  select jsonb_agg(g) into v_grants
  from jsonb_array_elements(v_payload -> 'grants') g
  where g ->> 'stakeholderId' = v_stakeholder_id;

  return json_build_object(
    'company',     v_payload -> 'company',
    'stakeholder', v_stakeholder,
    'grants',      coalesce(v_grants, '[]'::jsonb)
  );
end;
$$;

-- Grant execute permissions
grant execute on function public.create_workspace(text)              to authenticated;
grant execute on function public.create_workspace_invite(uuid)       to authenticated;
grant execute on function public.join_workspace_via_invite(uuid)     to authenticated;
grant execute on function public.create_grant_share_link(text)       to authenticated;
grant execute on function public.get_grant_by_share_token(uuid)      to anon, authenticated;
