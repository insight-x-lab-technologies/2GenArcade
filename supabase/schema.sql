-- 2GenArcade — leaderboard schema + Row Level Security.
-- Run this in the Supabase SQL editor (or `supabase db push`).
--
-- Auth model: anonymous sign-ins (Dashboard → Authentication → Providers →
-- "Anonymous sign-ins" must be ENABLED). Each device gets its own auth user;
-- the client stores a chosen nickname locally.

create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text        not null,
  nickname    text        not null check (char_length(nickname) between 1 and 12),
  score       bigint      not null check (score >= 0),
  score_type  text        not null check (score_type in ('points', 'distance', 'time')),
  created_at  timestamptz not null default now(),
  user_id     uuid        not null references auth.users (id) on delete cascade
);

-- Fast "top N per game" queries.
create index if not exists scores_game_score_idx
  on public.scores (game_id, score desc);

-- Fast "my scores" queries.
create index if not exists scores_user_idx
  on public.scores (user_id);

alter table public.scores enable row level security;

-- Rankings are public: anyone (even anonymous) may read.
drop policy if exists "scores_public_read" on public.scores;
create policy "scores_public_read"
  on public.scores
  for select
  using (true);

-- A user may only insert rows attributed to themselves.
drop policy if exists "scores_insert_own" on public.scores;
create policy "scores_insert_own"
  on public.scores
  for insert
  with check (auth.uid() = user_id);

-- No client-side update/delete: scores are immutable once submitted.
-- (Absence of UPDATE/DELETE policies means RLS denies them by default.)

-- ⚠️ ANTI-CHEAT NOTE
-- This schema does NOT protect against fabricated scores: the anon key is
-- public and any authenticated user can insert arbitrary plausible values.
-- The client does best-effort plausibility checks only (see src/lib/anticheat.ts).
-- TODO(server): validate scores in an Edge Function using signed, time-stamped
-- run tokens (HMAC) issued at game start, plus per-user rate limiting, then
-- restrict direct inserts to the service role.
