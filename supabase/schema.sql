-- Vestline: one workspace (JSON payload) per authenticated user. Each row's
-- user_id must equal the Clerk user's JWT `sub` (same as Clerk `user.id` in the app).
-- RLS ensures a session can only read/write its own row.
-- Run in Supabase SQL Editor after connecting Clerk: Authentication → Sign In / Up
-- → Third-party auth → Clerk. See: https://supabase.com/docs/guides/auth/third-party/clerk

create table if not exists public.vestline_app_data (
  user_id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.vestline_app_data enable row level security;

create policy "vestline_select_own"
  on public.vestline_app_data
  for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "vestline_insert_own"
  on public.vestline_app_data
  for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "vestline_update_own"
  on public.vestline_app_data
  for update
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "vestline_delete_own"
  on public.vestline_app_data
  for delete
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
