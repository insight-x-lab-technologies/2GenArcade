# 2GenArcade

**Fliperama de bolso** — a mobile-first PWA collection of *original* retro arcade
games. No third-party brands, art, music, or layouts: every name, sprite, and
sound is original. Built for portrait phones (~390px), installable, and fully
playable offline.

This repository ships the **complete foundation** plus **one polished reference
game — Block Drop**. The other 19 games are listed in the catalog (the contract
is ready) but intentionally **not built** yet; adding one is a self-contained
module (see [Adding a game](#adding-a-game)).

---

## Stack

| Concern        | Choice |
| -------------- | ------ |
| Build / dev    | Vite 6 + React 18 + TypeScript (strict, no loose `any`) |
| Rendering      | Custom canvas-2D engine, fixed-timestep loop + render interpolation |
| Styling        | Tailwind CSS (sunset *amber + violet* design tokens, CRT overlay) |
| State          | Zustand (shell navigation, settings, entitlements) |
| i18n           | i18next + react-i18next (pt-BR default, en; auto-detect) |
| Audio          | Tone.js — **synthesized** chiptune (no audio files); games declare sounds as data |
| Persistence    | IndexedDB via `idb` (in-memory fallback for tests) |
| Backend        | Supabase (Postgres + anonymous auth) for the leaderboard — optional |
| Monetization   | `EntitlementsProvider` abstraction (mock now; Stripe/IAP stubs) |
| PWA            | `vite-plugin-pwa` (Workbox `generateSW`), installable + offline |

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

The app runs **fully offline with a local-only leaderboard** if no Supabase
credentials are present — no backend required to develop or play.

### Scripts

| Command             | Does |
| ------------------- | ---- |
| `npm run dev`       | Vite dev server |
| `npm run build`     | `tsc -b` typecheck + production build (emits PWA assets) |
| `npm run preview`   | Serve the built `dist/` |
| `npm test`          | Vitest unit + integration suite |
| `npm run lint`      | ESLint (zero warnings allowed) |
| `npm run format`    | Prettier write |

There is also a headless end-to-end smoke test (`scripts/smoke.mjs`) that drives
splash → home → Block Drop gameplay in Chrome and asserts the canvas paints.
Build first, serve `dist/`, then `node scripts/smoke.mjs`.

---

## Supabase setup (optional)

The leaderboard works locally without Supabase. To enable shared rankings:

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers → Anonymous sign-ins → enable.** Each device
   gets its own anonymous auth user; the chosen nickname is stored locally.
3. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor (or
   `supabase db push`). It creates the `scores` table with **Row Level
   Security**: public read, insert-own-rows-only, no client update/delete.
4. Copy `.env.example` → `.env` and fill in from **Settings → API**:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

   **Never commit `.env`.** The anon key is public-by-design; secrets do not
   belong in the client.

> ⚠️ **Anti-cheat is client-side only and NOT secure.** `src/lib/anticheat.ts`
> does best-effort plausibility checks; the schema documents the server-side
> TODO (HMAC-signed run tokens validated in an Edge Function + rate limiting).
> Treat current scores as untrusted.

---

## Architecture

```
src/
  engine/     fixed-timestep loop, canvas manager (DPR-aware), input adapter, gestures
  types/      the game contract (GameModule / GameMeta / GameContext) + shared types
  lib/        storage (idb + memory), supabase, leaderboard (+offline sync queue),
              entitlements (mock), trophies, anticheat
  audio/      AudioEngine + GameAudioBus (interprets declarative chiptune)
  i18n/       i18next init + locales (common / shell / catalog / blockDrop)
  data/       packs + catalog (1 available game + 19 planned)
  shell/      Zustand store, App router, GameHost (builds GameContext, runs loop),
              screens (splash/home/detail/gameplay/gameover/store/settings/leaderboard/trophies)
  ui/         design-system components (VirtualDpad, etc.)
  games/
    block-drop/   the reference game (pure logic.ts is unit-tested)
```

### The game contract

Games talk to the outside world **only** through `GameContext` — they never
import the shell, store, Supabase, or DOM globals directly. This keeps games
portable and the contract stable (`src/types/game.ts`):

- **`GameContext`** — `canvas`, `input`, `audio`, `storage` (namespaced per
  game), `emit` (events to the shell), `i18n` (`TFunction`), `reducedMotion`,
  `viewport`.
- **`GameModule`** — `meta`, optional `sounds`, and lifecycle:
  `init(ctx)` → `update(dtFixed)` (fixed-timestep logic, seconds) →
  `render(alpha)` (interpolation factor 0–1) → `pause` / `resume` / `destroy`.
- **`GameModuleFactory`** — `{ meta, sounds?, create() }`, lazy-loaded by the
  catalog so each game is its own chunk.

The shell owns all side effects. A game `emit`s `score` (HUD), `gameover`
(`{ score, stats }`, persists + syncs + evaluates trophies), and `trophy`.

---

## Adding a game

1. Create `src/games/<your-game>/` with:
   - `logic.ts` — **pure** game state + transitions (keep it testable, no canvas).
   - `meta.ts` — a `GameMeta` (id, title/description i18n keys, `scoreType`,
     `controlScheme`, `trophies`, thumbnail).
   - `sounds.ts` — optional declarative `GameSoundKit` (notes/envelopes as data).
   - `<YourGame>.ts` — implements `GameModule` (reads input, mutates logic in
     `update`, draws in `render`, emits events).
   - `index.ts` — export a `GameModuleFactory`.
2. Add i18n strings under `catalog:gameTitles.<id>` / `gameDescriptions.<id>`
   and a `<yourGame>` namespace if needed, in **both** `locales/ptBR.ts` and
   `locales/en.ts`.
3. Register it in `src/data/catalog.ts`: set `status: 'available'` and a
   `load: () => import('@/games/<your-game>').then(m => m.<yourGame>Factory)`.
4. Assign it to a pack in `src/data/packs.ts` (free vs. paid).

`block-drop` is the worked example; copy its shape.

---

## Conventions & constraints

- **TypeScript strict**, no loose `any`. `npm run lint` must pass with zero warnings.
- **All user-facing text via i18n.** No hardcoded strings in components/games.
- **60 FPS** via fixed-timestep accumulator + interpolation — game logic is
  decoupled from frame rate.
- **Accessibility:** touch targets ≥44px, sufficient contrast, and
  `prefers-reduced-motion` is respected (animations/CRT effects soften).
- **Originality:** no third-party IP. Names, art, and audio are original.
- Audio unlocks on the first user gesture (browser autoplay policy) — the
  splash screen ("toque para inserir a ficha") is that gesture.

---

## Roadmap — the 20-game catalog

**Built:**
- 🟧 **Block Drop** — falling-shard puzzle with the *Overdrive* combo mechanic.
- 🐍 **Snake Coil** — original snake-genre game; collect orbs, chain combos,
  and fill *Surge* to phase through yourself at 2× points.
- 🛩️ **River Run** — original vertical scrolling shooter; weave a narrowing
  neon canyon through shifting biomes (city/forest/mountains/ocean/space) and a
  day→night cycle, blast varied ships (small scouts up to shooting heavies),
  refuel at big destructible tanks, grab 10 power-ups, and chase 30 trophies.
- 🏎️ **Road Burner** — original lane-based racing/dodge; weave a curving neon
  highway through bikes/cars/trucks/rigs, graze traffic to charge *Burn* and
  auto-ignite *Nitro*. Shifting terrains (asphalt/rain/mud/snow) change speed and
  grip, a day→afternoon→night cycle lights up brake lights, 8 temporary power-ups
  add chaos, and 30 trophies reward it all.
- 👾 **Star Defender** — original fixed shooter; hold off descending waves of
  wraiths, charge the *Nova* screen-sweep beam, and survive on three lives.

**Planned** (contract ready, not yet implemented):
Brick Bounce, Maze Muncher, Frog Crossing, Cannon Duel, Bug Blaster,
Asteroid Drift, Paddle Clash, Match Cascade, Pipe Flow, Light Flip,
Sliding Tiles, Sky Hopper, Cave Flyer, Tower Stack, Dodge Storm.

Packs: **Base** (free) · **Classics** · **Puzzle** · **Action** (paid, mock
entitlements).
