# Supabase setup (optional)

The leaderboard works locally without Supabase — the app runs **fully offline
with a local-only leaderboard** when no credentials are present. Follow these
steps only if you want shared, online rankings.

## Steps

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Anonymous sign-ins → enable.** Each device
   gets its own anonymous auth user; the chosen nickname is stored locally.
3. Run [`supabase/schema.sql`](../supabase/schema.sql) in the SQL editor (or
   `supabase db push`). It creates the `scores` table with **Row Level
   Security**: public read, insert-own-rows-only, no client update/delete.
4. Copy `.env.example` → `.env` and fill in the values from **Settings → API**:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

   **Never commit `.env`.** The anon key is public-by-design; real secrets do
   not belong in the client bundle.

## Deploying with the leaderboard (GitHub Pages)

The CI workflow (`.github/workflows/deploy.yml`) reads the same variables from
repository secrets. Add them under **Settings → Secrets and variables →
Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Without these secrets the deployed build still works — it just falls back to the
local-only leaderboard.

## Security note

> ⚠️ **Anti-cheat is client-side only and NOT secure.** `src/lib/anticheat.ts`
> does best-effort plausibility checks; the schema documents the server-side
> TODO (HMAC-signed run tokens validated in an Edge Function + rate limiting).
> Treat current scores as untrusted.
