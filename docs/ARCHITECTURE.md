# 2GenArcade — Arquitetura e Princípios

> Documento de referência da arquitetura desta central de jogos arcade
> **mobile-first** (PWA, retrato ~390px, offline, originais). Leia antes de
> iniciar qualquer feature, novo jogo ou retomada de item do `ROADMAP.md`.
>
> Estado em 2026-06-05: 6 jogos jogáveis + 14 planejados, 165 testes verdes.

---

## 1. Visão geral

A aplicação é uma **shell** (fliperama) que carrega **jogos** como módulos
independentes e preguiçosos (lazy chunks). A separação é deliberada e é o
princípio central: **a shell é dona de todo efeito colateral; o jogo é uma
caixa-preta determinística que só fala pelo contrato.**

```
Splash → Home (grade do catálogo) → Detail → Play (GameHost) → GameOver
                                  ↘ Store / Settings / Trophies / Leaderboard
```

### Camadas

| Camada    | Pasta          | Responsabilidade |
| --------- | -------------- | ---------------- |
| Engine    | `src/engine/`  | Loop fixo, canvas (DPR), input, gestos, math. Sem React, sem jogo. |
| Tipos     | `src/types/`   | O contrato: `GameModule`/`GameMeta`/`GameContext`, input, áudio, troféu, leaderboard. |
| Lib       | `src/lib/`     | Storage (idb + memória), Supabase, leaderboard (+fila offline), entitlements (mock), troféus, anticheat, haptics, uiSound. |
| Áudio     | `src/audio/`   | `AudioEngine` (Tone.js) + `GameAudioBus` que interpreta chiptune declarativo. |
| i18n      | `src/i18n/`    | i18next, locales `ptBR`/`en`. |
| Data      | `src/data/`    | `catalog.ts` (20 jogos) + `packs.ts` (free/pago). |
| Shell     | `src/shell/`   | Store Zustand, App router, `GameHost`, telas. |
| UI        | `src/ui/`      | Design-system (`VirtualDpad`, `ActionButtons`, `ZonePad`, etc.). |
| Games     | `src/games/`   | Um diretório por jogo, autocontido. |

---

## 2. O contrato de jogo (a regra mais importante)

Um jogo conversa com o mundo **exclusivamente** via `GameContext`
(`src/types/game.ts`). Ele **nunca** importa a shell, o store, Supabase, o
i18next global, nem toca o DOM/`window` direto. Isso mantém os jogos portáteis,
testáveis e o contrato estável.

`GameContext` entrega: `canvas`, `input` (`InputAdapter`), `audio` (`AudioBus`),
`storage` (KV namespeado pelo id do jogo), `emit`, `i18n` (`TFunction`),
`reducedMotion`, `viewport`.

Ciclo de vida do `GameModule`:
`init(ctx)` → `update(dtFixed)` → `render(alpha)` → `pause`/`resume`/`destroy`.

Eventos que o jogo emite (a shell faz o efeito):
- `score` → atualiza HUD (não persiste).
- `gameover` `{ score, stats }` → persiste best, sincroniza leaderboard, avalia
  troféus, navega para a tela de game over.
- `trophy` → premia/reavalia troféu.

> **Princípio:** se um jogo precisa de algo do mundo externo, isso entra **no
> contrato** (`GameContext`/`GameMeta`), não como import direto. Foi assim que
> os botões de ação (A1) e haptics (A2) nasceram: campos declarativos no
> `GameMeta`, sem vazar lógica de jogo para a shell.

### Anatomia de um jogo (`src/games/<id>/`)

| Arquivo            | Papel | Regra |
| ------------------ | ----- | ----- |
| `logic.ts`         | Estado + transições **puras** (sem canvas, sem DOM). | Testável em isolamento; constantes de dificuldade isoláveis aqui. |
| `<Game>.ts`        | Implementa `GameModule`: lê input, muta `logic` no `update`, desenha no `render`, emite eventos. | É a "casca" impura. |
| `meta.ts`          | `GameMeta`: id, chaves i18n, `scoreType`, `controlScheme`, `actionButtons?`, `trophies`, thumbnail. | Declarativo. |
| `sounds.ts`        | `GameSoundKit` opcional (notas/envelopes como dados). | Sem `import` de Tone.js. |
| `index.ts`         | Exporta o `GameModuleFactory` (`{ meta, sounds?, create() }`). | Carregado lazy pelo catálogo. |

`block-drop` é o exemplo-base; novos jogos copiam o formato.

---

## 3. Engine — determinismo e 60 FPS

- **Loop de timestep fixo** (`GameLoop.ts`): acumulador + interpolação (`alpha`).
  A lógica roda a passo constante (default 1/60s), desacoplada da taxa de quadros
  → simulação determinística a 60 ou 144 Hz. `render(alpha)` interpola entre o
  estado anterior e o atual para evitar stutter. Clamp de `maxFrameTime` evita a
  "espiral da morte" após troca de aba/GC.
- **CanvasManager**: dimensiona o canvas ao viewport lógico em CSS px e cuida do
  DPR. Jogos desenham contra `viewport.{width,height}`; não pensam em DPR.
- **InputAdapter** (`PointerInputAdapter`): normaliza pointer + teclado +
  controles on-screen em um **único fluxo** de `InputEvent`
  (`tap`/`swipe`/`hold`/`dpad`/`button`). Polling: `isHeld(dir)` e
  `isButtonHeld(id)`. Jogos **nunca** ouvem eventos de DOM diretamente.

> **Princípio:** toda a aleatoriedade e física vive no passo fixo. Nada de
> `Date.now()`/`Math.random()` no `render`. Isso prepara o terreno para o
> desafio diário com seed (A6) e mantém os testes determinísticos.

---

## 4. Controles — declarativos, um pipeline só

- Movimento por `controlScheme` (`dpad`/`swipe`/`tap`/`tilt`). Jogos de 4
  direções respeitam o `controlStyle` do usuário (`dpad`/`zones`/`swipe`).
- **Botões de ação** (tiro, míssil, nitro, dash, bomba) são declarados em
  `GameMeta.actionButtons` (`id`, `labelKey`, `glyph`, `accent`, `mode:
  tap|hold`). A shell os renderiza para **todos** os estilos de controle, com
  alvos ≥56px, e injeta no mesmo `InputAdapter`. O jogo lê `tap` via `subscribe`
  e `hold` via `isButtonHeld(id)`.
- Teclado de desktop mapeia os N botões declarados (J/Z, K/X, L/C) — também é o
  que permite o smoke headless dirigir tiro/míssil.

> **Princípio:** controles são dados, não DOM de jogo. Um jogo **nunca** desenha
> seus próprios botões — declara e a shell desenha.

---

## 5. Áudio — chiptune como dados

Jogos descrevem música/SFX como **dados** (`GameSoundKit`: `menu`/`gameplay`
tracks + `sfx`), sem importar Tone.js. O `GameAudioBus` interpreta. O áudio só
destrava no primeiro gesto do usuário (splash "toque para inserir a ficha"),
por causa da política de autoplay. Volume de música/efeitos e mudo são globais.

---

## 6. Persistência, leaderboard e meta

- **Storage**: IndexedDB via `idb`, com fallback em memória (testes). O
  `storage` do jogo é KV namespeado pelo id — **dados nunca vazam entre jogos**.
- **Leaderboard**: Supabase (Postgres + auth anônima) **opcional**. Sem credenciais,
  roda 100% local. Há **fila de sincronização offline** que drena ao voltar online.
- **Anti-cheat é client-side e NÃO é seguro** (`src/lib/anticheat.ts`,
  plausibilidade best-effort). O TODO server-side (token HMAC + Edge Function +
  rate limit) está documentado no schema. Tratar scores como não confiáveis.
- **Troféus**: declarativos por jogo. `condition` é um **predicado tipado**
  (não DSL de string) avaliado no game over e em eventos. Os `stats` que o jogo
  emite alimentam as condições.
- **Entitlements**: `EntitlementsProvider` (mock agora; stubs Stripe/IAP). Packs
  free vs. pago em `packs.ts`.

---

## 7. Restrições inegociáveis

1. **TypeScript strict**, sem `any` solto. `npm run lint` com **zero** warnings.
2. **Todo texto via i18n** nos **dois** locales (`ptBR` + `en`). Nada hardcoded.
3. **60 FPS** por timestep fixo + interpolação; lógica desacoplada do frame.
4. **Acessibilidade**: alvos de toque ≥44px (≥56px nos botões de ação),
   contraste suficiente, `prefers-reduced-motion` respeitado (anima/CRT suavizam).
5. **Originalidade total**: nenhum IP de terceiros — nomes, arte e áudio originais.
6. **Áudio destrava no primeiro gesto**; haptics é *enhancement* (iOS Safari não
   tem `vibrate` → no-op), nunca dependência de gameplay.
7. **Jogo só fala pelo `GameContext`**; efeito colateral é da shell.
8. **`logic.ts` puro e testado**; constantes de dificuldade isoláveis.

---

## 8. Como adicionar um jogo (checklist)

1. Criar `src/games/<id>/` com `logic.ts` (puro), `meta.ts`, `sounds.ts?`,
   `<Game>.ts`, `index.ts` (exporta o factory). Copiar o formato de `block-drop`.
2. Strings i18n em `catalog:gameTitles.<id>` / `gameDescriptions.<id>` (+namespace
   próprio se preciso) nos **dois** locales.
3. Registrar em `src/data/catalog.ts`: `status: 'available'` + `load: () =>
   import('@/games/<id>').then(m => m.<id>Factory)`.
4. Atribuir a um pack em `src/data/packs.ts`.
5. Testes de `logic.ts` (unit) + integração do `GameModule`. `npm run lint` e
   `npm test` verdes antes do commit.

---

## 9. Estado do roadmap (síntese)

- **Plataforma (Parte A):** A1 (botões de ação), A2 (haptics + clique), A3
  (reiniciar no pause) **feitos**. Pendentes: A4 (resumo de run + progresso de
  troféu), A5 (dificuldades), A6 (desafio diário com seed).
- **M2 (pedidos por jogo) concluído:** B1, E.1/E.2/E.3, D.1/D.2, C.1, F.1/F.2, G.1.
- **Pendências de conteúdo:** B2/B3/B4 (River Run), C.2/C.3/C.4 (Snake Coil),
  D.3/D.4 (Road Burner), E.4 (Star Defender), F.3/F.4 (Brick Bounce),
  G.2/G.3 (Block Drop). Detalhes e prioridades em `ROADMAP.md`.

---

## 10. Oportunidades de melhoria (antes de novos jogos)

Itens de **fundação** que amortizam custo entre os 6 jogos atuais e os 14
planejados — candidatos a fazer antes de abrir novas frentes:

1. **Kit compartilhado de gameplay (`src/games/_shared/`):** os 4 jogos de
   ação repetem padrões (power-ups temporários, partículas/screen-shake com
   respeito a `reducedMotion`, spawner, pools de projéteis, sistema de chefe).
   Hoje cada `<Game>.ts` tem ~1000–1400 linhas com muita duplicação. Extrair
   helpers puros e testados reduz risco e acelera Bug Blaster/Cannon Duel/
   Dodge Storm/Cave Flyer planejados. **Maior alavanca do projeto.**
2. **A4 antes do resto:** resumo de run + barras de progresso de troféu usa
   `stats` que os jogos **já emitem**; alto valor percebido, baixo custo.
3. **RNG semeado no contrato (prepara A6):** injetar um `rng` determinístico via
   `GameContext` e migrar os jogos para usá-lo no passo fixo. Destrava desafio
   diário e torna testes de integração mais robustos.
4. **`A5` dificuldade como infra:** as constantes de dificuldade já estão em
   `logic.ts`; padronizar um seletor (Casual/Clássico/Insano) na shell evita
   reimplementar por jogo.
5. **Template/gerador de jogo:** um scaffold (script em `scripts/`) que cria o
   esqueleto de `src/games/<id>/` + entradas de catálogo/i18n reduz erro humano
   no passo 1–4 e padroniza os 14 planejados.
6. **Documentar/segurar performance:** sem orçamento de objetos por frame nem
   teste de FPS além do smoke. Considerar pools e um smoke que afira tempo de
   frame nos jogos mais pesados (River Run, Road Burner).
7. **Anti-cheat server-side (dívida conhecida):** se o leaderboard for levado a
   sério, fechar o TODO (token HMAC + Edge Function + rate limit).

> Recomendação: priorizar **(1)** e **(3)** como fundação, depois **(2)/(4)**
> como meta/rejogabilidade — exatamente o que o `ROADMAP.md` chama de M3/M4 —
> **antes** de iniciar os jogos planejados, para não multiplicar a duplicação
> atual por mais 14 módulos.
