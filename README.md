# Vestline

Web app for **modeling equity grants, vesting, and a simple cap-table view** for early-stage teams. Each signed-in user gets their **own workspace** (Supabase row + per-user browser cache).

**Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Recharts, date-fns  
**Optional cloud:** [Clerk](https://clerk.com) (auth) + [Supabase](https://supabase.com) (Postgres + Row Level Security)

---

## Features

- Company settings and optional **authorized share count** (used for ownership % and entering grants as **% of authorized**, e.g. 0.1%–1% for hires)
- **Stakeholders** and **grants** (common, ISO, NSO, RSU labels for categorization)
- **Vesting schedules** (cliff + monthly table, chart)
- **Overview** dashboard: granted / vested / unvested, ownership chart, milestone dates
- **Local-only mode** if `VITE_CLERK_PUBLISHABLE_KEY` is unset (data stays in this browser’s `localStorage`)

---

## Quick start

```bash
npm install
cp .env.example .env
# Edit .env — see below
npm run dev
```

| Script    | Description        |
| --------- | ------------------ |
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

---

## Environment variables

Copy `.env.example` to `.env` (or `.env.local`). **Never commit `.env`** — it is gitignored.

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | No* | Clerk sign-in; omit for local-only mode |
| `VITE_SUPABASE_URL` | For sync | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | For sync | Supabase **anon** (JWT) key — not the service role |

\*With Clerk + Supabase configured, data syncs to `public.vestline_app_data` (one JSON payload per user). See `supabase/schema.sql`.

### Clerk + Supabase

1. In **Supabase**: Authentication → **Third-party auth** → add **Clerk** (match your Clerk domain).
2. In **Clerk**: complete the **Supabase** integration for your project.
3. Use the **anon** key from Supabase Project Settings → API in `VITE_SUPABASE_ANON_KEY`.

If requests fail with **PGRST301** (“No suitable key to decode the JWT”), the JWT path between Clerk and Supabase is misconfigured or the wrong key type is in use — see comments in `.env.example`.

---

## Database

Run `supabase/schema.sql` in the Supabase SQL editor for the **same** project as `VITE_SUPABASE_URL`. It creates `vestline_app_data` with RLS so each user can only read/write rows where `user_id` matches their JWT `sub` (Clerk user id).

---

## Repository

[github.com/Rohit1mag/vestline](https://github.com/Rohit1mag/vestline)

---

## Disclaimer

Vestline is a **planning / modeling** tool. It does not provide legal, tax, or investment advice. Real grants and cap tables should be reviewed with qualified counsel.
