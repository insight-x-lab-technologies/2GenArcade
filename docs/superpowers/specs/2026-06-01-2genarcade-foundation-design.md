# 2GenArcade — Foundation + Reference Game (Block Drop)

Date: 2026-06-01
Status: Approved (proceed to implementation)

## Goal

A "pocket arcade": a PWA collection of original retro arcade games (inspired by
classics, no third-party IP). Deliver the **complete foundation** plus **one
fully playable, polished reference game (Block Drop)**. The other ~20 games are
NOT built — the architecture must be ready to receive them via a stable game
contract.

Primary target: mobile portrait (~390px). Desktop is secondary.

## Non-negotiables

- Web app + PWA (installable, offline).
- No third-party brands/art/music/layouts. Original names + art.
- TypeScript strict, no loose `any`.
- 60 FPS gameplay: `requestAnimationFrame` loop with fixed timestep accumulator
  + render interpolation (`alpha`). Logic decoupled from frame rate.
- All user-facing text via i18n (i18next), pt-BR default + en, auto-detect.
- Basic a11y: touch targets >= 44px, adequate contrast, respect
  `prefers-reduced-motion`.

## Stack

- React 18 + TypeScript + Vite; PWA via `vite-plugin-pwa`.
- Games rendered on `<canvas>` 2D with a lightweight custom engine.
- Tailwind CSS for UI; React for off-canvas UI state.
- Zustand for global state.
- i18next + react-i18next.
- Tone.js for synthesized chiptune (menu + gameplay tracks, SFX per event).
- Supabase (Postgres + anonymous Auth) for leaderboard — provisioned live via
  the Supabase MCP. `supabase/schema.sql` holds schema + RLS.
- IndexedDB via `idb` for pending scores, trophies, settings, entitlements +
  sync queue.
- Entitlements via `EntitlementsProvider` interface; mock-local impl now;
  Stripe / store-IAP impls stubbed behind the same interface.

## Key trade-off decisions

1. **Audio autoplay.** AudioContext stays suspended until first user gesture
   (Splash tap unlocks it). Music never plays before interaction. Volumes/mute
   persist in IndexedDB.
2. **Supabase cost / anti-cheat.** Free tier is sufficient. Anonymous auth mints
   one user per device (accumulates in `auth.users`, harmless at this scale).
   Score validation is client-side plausibility only, clearly labeled
   best-effort, with `TODO: server-side validation`. Not presented as secure.
3. **IAP in PWA.** Store IAP is unavailable to web PWAs; real web monetization is
   Stripe Checkout, native store IAP only via later wrapping (Capacitor/TWA).
   Hence the `EntitlementsProvider` abstraction with mock now.

## Architecture

Single Vite app. Folders:

- `src/types` — shared contracts: `GameModule`, `GameMeta`, `GameContext`,
  `InputAdapter`, `AudioBus`, `GameStorage`, `GameEventEmitter`, `TrophyDef`,
  `ControlScheme`, pack/entitlement/score types.
- `src/engine` — fixed-timestep loop (accumulator + render alpha), canvas
  manager, input adapter (swipe/tap/hold/virtual d-pad -> logical actions).
- `src/audio` — `AudioBus` (separate music/SFX channels, independent persisted
  volumes, fade between menu/gameplay tracks, global mute, autoplay unlock).
- `src/i18n` — namespaced resources, pt-BR + en, detection + fallback.
- `src/data` — packs, game registry, trophy definitions.
- `src/lib` — `supabase` client + leaderboard, `idb` storage + sync queue,
  `entitlements` provider (mock + stubs).
- `src/shell` — screens + Zustand store/router; mounts/unmounts canvas, manages
  pause/resume, captures `gameover`, persists/syncs score, evaluates trophies,
  plays the right track.
- `src/ui` — design-system components (arcade button, game card, modal, toggle,
  volume slider, trophy badge, online/offline header, CRT overlay).
- `src/games/block-drop` — the reference game.

### Game contract

Games interact with the outside world ONLY through `GameContext`. The shell owns
Supabase, i18n, audio, persistence, and trophy evaluation. Interface as given in
the brief (`GameMeta`, `GameContext`, `GameModule` with
init/update(dtFixed)/render(alpha)/pause/resume/destroy).

### Screens / flow

Splash -> Home (game grid; locked games show lock) -> Game detail (preview, best
score, Play, trophies) -> Gameplay -> Game Over (score, records, replay, share)
-> Store (packs) -> Settings (language, music/SFX volume, about) + Leaderboard &
Trophies views.

### Offline

Service worker caches shell + assets. Scores/trophies work offline and sync on
reconnect. Online/offline state shown in header. Leaderboard falls back to local
cache when offline.

### Leaderboard (Supabase)

- Anonymous auth; nickname stored locally.
- `scores(id, game_id, nickname, score, score_type, created_at, user_id)`.
- RLS: insert only with own `user_id`; public read.
- Offline submit queue in IndexedDB, sync on reconnect.
- Per-game view: top N global + player's position; local cache when offline.

### Trophies

Declarative per game (`TrophyDef`: id, name/description i18n keys, condition,
icon). Evaluated at gameover and during play via events. Local persistence +
optional sync. Per-game and global trophy screens (locked/unlocked).

### Entitlements / packs

`pack` -> many `game_id`. Base pack free. Paid-pack games locked on Home until
entitlement exists. `EntitlementsProvider` mock allows local "purchase" for
testing. Store lists packs with placeholder price, i18n description, buy (mock).

## Design system (Âmbar + Roxo "sunset arcade")

Deep purple-black background, warm amber/orange accents with a touch of violet.
Pixel display font for titles + legible mono for UI. Subtle, toggleable CRT
overlay (light scanlines + vignette) respecting `prefers-reduced-motion`. Smooth
screen transitions that never block gameplay. Follow the frontend-design skill.

## Block Drop (reference game)

Falling-blocks genre with its own identity (NOT Tetris): amber/purple sunset
tiles, an original 7-piece "shard" set (deviated shapes incl. one signature
5-cell piece), line-clear scoring with a signature **Overdrive combo meter**,
progressive endless speed-up. >=4 trophies, menu + gameplay chiptune tracks,
SFX, swipe/tap controls + optional on-screen d-pad, pause, game over, score
submit, trophy eval — all via `GameContext`.

## Build order (always runnable)

toolchain -> types/engine -> shell + design system -> Block Drop -> audio ->
i18n -> IndexedDB -> Supabase -> entitlements -> PWA -> README. Confirm green
build and end-to-end Block Drop play at the end.

## Out of scope (this phase)

The other 19 games (contract ready for them); real payment gateway; server-side
score validation; account/login beyond anonymous.
