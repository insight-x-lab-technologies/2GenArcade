# 2GenArcade

**Pocket arcade** — a mobile-first PWA collection of *original* retro arcade
games. No third-party brands, art, music, or layouts: every name, sprite, and
sound is original. Built for portrait phones (~390px), installable, and fully
playable offline.

This repository ships the **complete foundation** plus **six polished games**.
The remaining 14 titles are listed in the catalog (the contract is ready) but
intentionally **not built** yet; adding one is a self-contained module (see
[Adding a game](#adding-a-game)).

---

## Stack

| Concern        | Choice |
| -------------- | ------ |
| Build / dev    | Vite 6 + React 18 + TypeScript (strict, no loose `any`) |
| Rendering      | Custom canvas-2D engine, fixed-timestep loop + render interpolation |
| Styling        | Tailwind CSS (sunset *amber + violet* design tokens, CRT overlay) |
| State          | Zustand (shell navigation, settings, entitlements) |
| i18n           | i18next + react-i18next (en default, pt-BR; auto-detect) |
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
credentials are present — no backend required to develop or play. To enable
shared online rankings, see [Supabase setup](docs/SUPABASE.md).

### Scripts

| Command             | Does |
| ------------------- | ---- |
| `npm run dev`       | Vite dev server |
| `npm run build`     | `tsc -b` typecheck + production build (emits PWA assets) |
| `npm run preview`   | Serve the built `dist/` |
| `npm test`          | Vitest unit + integration suite |
| `npm run lint`      | ESLint (zero warnings allowed) |
| `npm run format`    | Prettier write |

There are also headless end-to-end smoke tests under `scripts/` (one per game,
plus `scripts/smoke.mjs` for Block Drop) that drive splash → home → gameplay in
Chrome and assert the canvas paints. Build first, serve `dist/`, then run the
relevant `node scripts/smoke-*.mjs`.

---

## Deployment

The site is published to **GitHub Pages** via `.github/workflows/deploy.yml`,
which runs on every push to `main`: it installs dependencies, builds the PWA,
and publishes `dist/`. The Vite `base` is set to `/2GenArcade/` so all assets
and the service worker resolve under the project subpath.

In the repository, **Settings → Pages → Source** must be set to **GitHub
Actions**. The live site is served at
`https://<owner>.github.io/2GenArcade/`.

For the online leaderboard in deployed builds, add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` as repository **Actions secrets** (see
[Supabase setup](docs/SUPABASE.md)). Without them the deployed build still works
with a local-only leaderboard.

---

## Architecture

```
src/
  engine/     fixed-timestep loop, canvas manager (DPR-aware), input adapter, gestures
  types/      the game contract (GameModule / GameMeta / GameContext) + shared types
  lib/        storage (idb + memory), supabase, leaderboard (+offline sync queue),
              entitlements (mock), trophies, anticheat, haptics, UI sound
  audio/      AudioEngine + GameAudioBus (interprets declarative chiptune)
  i18n/       i18next init + locales (common / shell / catalog + one namespace per game)
  data/       packs + catalog (6 available games + 14 planned)
  shell/      Zustand store, App router, GameHost (builds GameContext, runs loop),
              screens (splash/home/detail/gameplay/gameover/store/settings/leaderboard/trophies)
  ui/         design-system components (VirtualDpad, ActionButtons, etc.)
  games/
    block-drop/   reference game; each game's pure logic.ts is unit-tested
    snake-coil/  river-run/  road-burner/  star-defender/  brick-bounce/
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
     `controlScheme`, optional `actionButtons`, `trophies`, thumbnail).
   - `sounds.ts` — optional declarative `GameSoundKit` (notes/envelopes as data).
   - `<YourGame>.ts` — implements `GameModule` (reads input, mutates logic in
     `update`, draws in `render`, emits events).
   - `index.ts` — export a `GameModuleFactory`.
2. Add i18n strings under `catalog:gameTitles.<id>` / `gameDescriptions.<id>`
   and a `<yourGame>` namespace if needed, in **both** `locales/ptBR.ts` and
   `locales/en.ts` (parity is enforced by `i18n.test.ts`).
3. Register it in `src/data/catalog.ts`: set `status: 'available'` and a
   `load: () => import('@/games/<your-game>').then(m => m.<yourGame>Factory)`.
4. Assign it to a pack in `src/data/packs.ts` (free vs. paid).

`block-drop` is the worked example; copy its shape.

---

## Conventions & constraints

- **TypeScript strict**, no loose `any`. `npm run lint` must pass with zero warnings.
- **All user-facing text via i18n.** No hardcoded strings in components/games;
  pt-BR and en key sets are kept in parity.
- **60 FPS** via fixed-timestep accumulator + interpolation — game logic is
  decoupled from frame rate.
- **Accessibility:** touch targets ≥44px, sufficient contrast, and
  `prefers-reduced-motion` is respected (animations/CRT effects soften).
- **Originality:** no third-party IP. Names, art, and audio are original.
- Audio unlocks on the first user gesture (browser autoplay policy) — the splash
  screen ("tap to insert the coin") is that gesture.

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
  trigger *Nitro* or a side *Dash*. Shifting terrains (asphalt/rain/mud/snow)
  change speed and grip, oncoming traffic and oil slicks raise the stakes, a
  day→afternoon→night cycle lights up brake lights, 8 temporary power-ups add
  chaos, and 30 trophies reward it all.
- 👾 **Star Defender** — original fixed shooter; hold off descending waves of
  wraiths, charge the *Nova* screen-sweep beam, and survive on three lives.
- 🧱 **Brick Bounce** — original breakout-style game; steer the paddle to keep a
  glowing ball alive and smash neon brick walls of varied kinds (steel,
  explosive, moving, regenerating). Fill the *Blaze* to ignite a piercing,
  double-points Blaze Ball, catch seven temporary power-ups (wide paddle,
  multiball, slow-mo, magnet, cannons, floor shield, bonus), and climb endless,
  faster levels across 8 trophies.

**Planned** (contract ready, not yet implemented):
Maze Muncher, Frog Crossing, Cannon Duel, Bug Blaster,
Asteroid Drift, Paddle Clash, Match Cascade, Pipe Flow, Light Flip,
Sliding Tiles, Sky Hopper, Cave Flyer, Tower Stack, Dodge Storm.

Packs: **Base** (free) · **Classics** · **Puzzle** · **Action** (paid, mock
entitlements).
