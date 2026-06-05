# 2GenArcade — Roadmap de Evolução

> Análise dos 6 jogos já implementados + plano de evolução por jogo e da
> plataforma (shell/engine). Datas/prioridades a partir de **2026-06-04**.
>
> Convenções:
> - **Prioridade:** `P0` (faz diferença já / desbloqueia outros) · `P1` (alto valor) · `P2` (polimento/futuro).
> - **Esforço:** `S` (≤1 dia) · `M` (2–4 dias) · `L` (≥1 semana).
> - Tudo respeita as restrições do projeto: TS strict, i18n pt-BR+en, só via
>   `GameContext`, 60 FPS, `prefers-reduced-motion`/mudo, arte/áudio originais.

---

## Parte A — Plataforma (cross-cutting, vale para todos os jogos)

Estes itens são a **fundação**: vários pedidos por jogo dependem deles. Priorizar
primeiro porque amortizam o custo entre os 6 jogos atuais e os 14 planejados.

### A1. Infra de botões de ação (`isButtonHeld` + botões declarativos) — `P0` · `M` — ✅ FEITO (2026-06-04)
**Por quê:** hoje o `InputAdapter` rastreia só *direções* como "held"; `kind:'button'`
é apenas evento momentâneo (`InputAdapter.ts:53`) e o `VirtualDpad` layout `cross`
**não desenha nenhum botão de ação** (`VirtualDpad.tsx:41`). Sem isso, não dá para
ter tiro manual, troca de arma, nitro manual, etc. É o item que destrava A's pedidos
de River Run e metade das melhorias dos shooters.

**Escopo:**
- `PointerInputAdapter`: adicionar `heldButtons: Set<string>` + `isButtonHeld(id)`;
  `dispatch` de `kind:'button'` passa a alimentar press/release no set. Teclado:
  mapear teclas (Espaço/Z/X) para botões nomeados além do atual `'action'`.
- `GameMeta`: novo campo opcional
  `actionButtons?: Array<{ id; labelKey; glyph; accent?; mode: 'tap' | 'hold' }>`.
- `GameHost`: renderizar os botões declarados ao lado do d-pad (layout `cross`),
  como botões flutuantes no canto inferior-direito nos estilos `zones`/`swipe`,
  com alvos ≥56px (já é o padrão do `PadKey`).
- Jogos passam a ler `input.isButtonHeld('fire')` (hold) ou ouvir o evento (tap).
- Testes: unit no adapter (held/release/limpeza no destroy) + integração por jogo.

**Desbloqueia:** River Run (B3.1), Star Defender (E.1/E.2), Road Burner (D.1),
Snake Coil (C.1), Brick Bounce (F.1) e jogos planejados (Cannon Duel, Bug Blaster…).

### A2. Feedback tátil (haptics) + clique configurável — `P1` · `S–M` — ✅ FEITO (2026-06-04)
**Pedido direto do A.** Hoje não há vibração nem som de clique nos controles.

**Implementado (clique):** `src/lib/uiSound.ts` espelha o módulo de haptics — flag
global mirada do Settings, toca um clique curto via o SFX bus compartilhado (logo
respeita volume de efeitos + mudo, e é no-op até o áudio destravar). Disparado em
`ArcadeButton`/`VirtualDpad`/`ActionButtons` junto do `vibrate`. Novo toggle
"Som de clique" na `SettingsScreen` (default ligado) + strings i18n.

**Escopo:**
- `src/lib/haptics.ts`: wrapper de `navigator.vibrate(pattern)` com *feature
  detection* (iOS Safari não suporta → no-op silencioso, progressive enhancement)
  e respeito ao mudo/`reducedMotion` opcional.
- `Settings`: novos campos `haptics: boolean` e `haptics Intensity?: 'light'|'strong'`
  (default ligado). Persistir em `store.ts` igual aos demais; toggle na
  `SettingsScreen`; strings i18n nos dois locales.
- Disparo no nível do shell: ao pressionar `PadKey`/`ArcadeButton` (clique tátil +
  SFX de clique opcional via `AudioBus`).
- Expor canal opcional para jogos no `GameContext` (`ctx.haptics?.pulse(eventName)`)
  com uma paleta de padrões por evento (acerto, dano, level-up). Mesma filosofia do
  áudio declarativo.

### A3. Reiniciar dentro do jogo (pause + game over) — `P1` · `S` — ✅ FEITO (2026-06-04, botão Reiniciar no pause)
**Esclarecimento:** *"Jogar de novo" já existe e funciona* — botão em
`GameOverScreen.tsx:90`, e o `GameHost` remonta limpo via `sessionKey`
(`App.tsx:147`). O que falta:
- **Botão "Reiniciar"** no overlay de pausa (`GameHost.tsx:282` só tem
  Continuar/Sair). Implementação: re-`navigate({name:'play'})` ou bump de
  `sessionKey` para forçar remount — sem sair para a tela de game over.
- Game over: tornar o "Jogar de novo" o foco visual primário (já é `block`) e
  permitir **toque-em-qualquer-lugar** para repetir, reduzindo fricção.

### A4. Resumo de run + progresso de troféus — `P2` · `M`
- Tela de game over mostra **estatísticas da partida** (kills, distância, nível,
  power-ups) que os jogos já emitem em `stats` — hoje são usadas só para troféus.
- Barras de progresso nos troféus ainda não conquistados ("523/500" etc.).

### A5. Seleção de dificuldade / acessibilidade — `P2` · `M`
- Modo "Casual / Clássico / Insano" afetando curva de velocidade e vidas.
  Cada jogo já tem constantes de dificuldade isoláveis em `logic.ts`.
- Importante para River Run/Star Defender, que hoje só têm uma curva.

### A6. Desafio diário com seed — `P2` · `L`
- RNG semeado por data → ranking diário separado. Reaproveita o leaderboard
  existente (novo `gameId` lógico `<game>:daily:<yyyy-mm-dd>`).

---

## Parte B — River Run 🛩️ (o foco do A)

**Estado atual:** shooter vertical com auto-fire, 5 tipos de inimigo
(scout→dread), tanques de combustível, biomas (cidade/floresta/montanha/oceano/
espaço), ciclo dia↔noite, 10 power-ups, 30 troféus, score por distância.

### B1. Tiro opcional + dois tipos de arma — `P0` · `M` (depende de A1) — ✅ FEITO (2026-06-04)
**Pedido direto do A.** Hoje `autoFire()` dispara sozinho (`RiverRunGame.ts:391`).
- **Tornar o tiro manual** (opt-in). Botão **Tiro** primário: segurar = rajada de
  tiro simples (reusa a cadência atual `FIRE_NORMAL/RAPID/BOOST`).
  - Manter uma opção **"Auto-fire"** nas configurações para quem prefere o atual
    (acessibilidade) — default a definir com o A (sugiro manual ligado).
- **Segunda arma — Míssil:** botão dedicado. Mais forte, **explode em área**
  (dano em raio, atinge vários inimigos), porém **munição reduzida**. Recarrega
  por pickup (novo power-up "ogiva") e/ou cooldown longo.
  - HUD: contador de mísseis; SFX/explosão própria + leve screen-shake (respeita
    `reducedMotion`); partículas de explosão.
  - Troféus novos: "primeiro míssil", "X inimigos numa explosão".

### B2. Mini-chefes nas transições de bioma — `P1` · `L` — ✅ FEITO (2026-06-05)
- A cada mudança de bioma, um gunship-chefe com padrão de tiro e HP alto.
  Recompensa grande + power-up garantido. Dá ritmo a um jogo hoje "infinito plano".
- **Implementado:** entidade de chefe única e aditiva (sem chefe = comportamento
  atual idêntico) que entra pelo topo a cada transição de bioma (índice ≥ 1), com
  HP/recompensa escalando por bioma. Padrões de tiro (leque + rajada mirada,
  reusando o fluxo de `enemyBullets`), colisão com tiro/míssil/jogador, abate dá
  pontos altos + **power-up garantido** + barra de HP. Spawn de inimigos comuns
  pausa enquanto o chefe está em cena. Helpers puros testados (`bossDueForIndex`,
  `bossHpForIndex`, `bossRewardForIndex`); troféus **Senhor da guerra** (1 chefe)
  e **Soberano** (5 numa partida).

### B3. Variedade de combate — `P1` · `M`
- Formações de inimigos (V, ondas, kamikazes), não só spawn aleatório.
- Power-up "wingman" (drone que atira junto), "bomba de tela".

### B4. Polimento de feel — `P2` · `S`
- Trilha do tiro/míssil distinta; tracer de bala; feedback de fuel baixo (pulso
  vermelho + haptics A2).

---

## Parte C — Snake Coil 🐍

**Estado atual:** snake original, orbs, combos, *Surge* (atravessa a si mesmo a
2× pontos, auto-disparado), d-pad, 5 troféus, score por pontos.

### C.1. Botão de Dash / Surge manual — `P1` · `S` (depende de A1) — ✅ FEITO (2026-06-04, Descarga manual)
- Botão de **arrancada curta** (consome combo) para escapar de enrascadas — dá
  skill ceiling. Alternativa: disparar o Surge manualmente em vez de automático.
- **Implementado:** a Descarga agora é acionada por botão quando carregada
  (antes auto), permitindo guardar a travessia para quando a Espiral se encurrala.
  Indicador "DESCARGA PRONTA" pulsa no HUD.

### C.2. Hazards e variedade de mapa — `P1` · `M` — ✅ FEITO (2026-06-05, paredes + tiles de lentidão)
- Paredes internas/obstáculos móveis, portais (entra de um lado, sai do outro),
  tiles de lentidão. Modos "com parede" vs "wrap-around" selecionáveis.
- **Implementado:** a partir do nível 3 surgem **paredes internas letais**
  (vermelhas; a Descarga não atravessa) e **ladrilhos de lentidão** (azuis;
  deixam a Espiral lenta por alguns ticks), re-roladas a cada nível e posicionadas
  longe da cabeça (zona de segurança) e do orbe — nunca uma armadilha inevitável.
  Os orbes nunca nascem sob paredes. Lógica de colocação pura e testada
  (`placeHazards`/`safetyZone`/`wallCountForLevel`/`slowCountForLevel`); troféu
  **Desbravador** (12 orbes com obstáculos no tabuleiro). Portais e o seletor
  wrap-around ficaram de fora desta primeira versão (deferidos).

### C.3. Orbs especiais — `P2` · `S`
- Orb de encolher, ímã (atrai orbs por alguns segundos), x2 temporário,
  orb-bomba (limpa cauda em excesso). Reaproveita o padrão de power-ups dos outros.

### C.4. Mais troféus / metas longas — `P2` · `S`
- Hoje só 5; expandir para ~15 (comprimentos, combos altos, sobreviver a hazards).

---

## Parte D — Road Burner 🏎️

**Estado atual:** corrida/desvio em pistas, *Burn*→*Nitro* auto-ignição,
terrenos (asfalto/chuva/lama/neve), ciclo de dia, 8 power-ups, 30 troféus,
score por distância.

### D.1. Nitro manual + drift/esquiva — `P1` · `M` (depende de A1) — ✅ FEITO (2026-06-04)
- Botão para **acionar o Nitro** quando o Burn está cheio (em vez de auto) → mais
  controle/estratégia. Botão de **drift/dash lateral** para esquiva rápida.
- **Implementado:** botão **Nitro** (tap, ignite quando o Burn enche; HUD mostra
  "NITRO PRONTO") + botão **Esquiva** (tap, arrancada lateral que ignora a
  aderência — funciona até na chuva/barro/neve — com cooldown). SFX de esquiva.

### D.2. Tráfego em sentido contrário + obstáculos — `P1` · `M` — ✅ FEITO (2026-06-04)
- Faixa de carros vindo na contramão, óleo/poças, rampas/saltos. Aumenta tensão.
- **Implementado:** veículos na **contramão** (faróis brancos, alta velocidade de
  aproximação; só após ~1400 m, probabilidade rampando com a distância) que valem
  Combustão/pontos em dobro ao passar raspando + troféu **Contramão** (15 passes).
  **Manchas de óleo** que não matam, mas zeram a aderência por ~1,1 s (derrapagem;
  Pneus de Corrida ignoram). Constantes puras + testes de `oncomingChance`.

### D.3. Rival AI / draft aprofundado — `P2` · `L`
- Um ou dois carros-rival com IA; aproveitar o vácuo (draft) por mais pontos.

### D.4. Eventos de clima dinâmicos — `P2` · `S`
- Transições de clima com impacto visual+grip mais marcado; haptics em derrapagem.

---

## Parte E — Star Defender 👾

**Estado atual:** shooter fixo, auto-fire, feixe *Nova* (varredura), 3 vidas,
ondas, 5 troféus, score por pontos. É o jogo **mais raso** em sistemas (sem
power-ups, ao contrário de River Run/Road Burner).

### E.1. Tiro manual + segunda arma — `P1` · `M` (depende de A1; reusa B1) — ✅ FEITO (2026-06-04, tiro manual; 2ª arma = barragem Nova)
- Mesma infra do River Run: tiro manual opcional + arma secundária
  (ex.: spread/carregado). Bom candidato a compartilhar código com B1.

### E.2. Nova manual (botão de bomba) — `P1` · `S` (depende de A1) — ✅ FEITO (2026-06-04)
- Acionar o Nova como "smart bomb" no momento certo, em vez de automático.

### E.3. Sistema de power-ups + chefes — `P1` · `L` — ✅ FEITO (2026-06-04)
- Trazer o padrão de power-ups dos outros jogos (escudo, rapid, double, vida
  extra). Chefe ao fim de cada N ondas com padrão de ataque.

### E.4. Padrões de inimigo — `P2` · `M`
- Mergulhos/dive-bombing, formações que se movem em bloco, inimigos com escudo.

---

## Parte F — Brick Bounce 🧱

**Estado atual:** breakout original, *Blaze* (bola de fogo perfurante 2× pontos,
auto-ignição), 7 power-ups, 8 troféus, níveis infinitos mais rápidos, pontos.

### F.1. Disparo de Blaze + mira de saque — `P1` · `S` (A1 p/ Blaze) — ✅ FEITO (2026-06-04)
- Botão para **disparar o Blaze** no momento ideal (em vez de auto).
- Linha de mira/preview de ângulo no saque (já existe saque angulado; mostrar a
  trajetória inicial melhora muito o feel).
- **Implementado:** botão **Bola de fogo** (tap, acende a bola perfurante quando
  a Chama enche; HUD "CHAMA PRONTA"). Linha de mira tracejada no saque que
  traça a trajetória (com ricochetes nas paredes) e segue a posição da raquete.

### F.2. Variedade de bricks — `P1` · `M` — ✅ FEITO (2026-06-04)
- Bricks explosivos (dano em cadeia), indestrutíveis, móveis, regenerativos,
  portais. O modelo de HP por brick já existe — extensão natural.
- **Implementado:** tipos **explosivo** (estoura vizinhos no raio, em cadeia),
  **aço** (indestrutível — ricocheteia até a bola de fogo, não conta p/ limpar a
  fase), **móvel** (desliza e bate nas paredes) e **regenerativo** (recupera HP se
  não for finalizado). Aparecem da fase 2+ via `pickBrickKind` (puro, testado),
  com marcadores visuais. Troféu **Reação em cadeia** (20 abates por explosão).

### F.3. Temas/Chefe de fase — `P2` · `M`
- "Brick-chefe" grande de múltiplos hits a cada N fases; layouts temáticos
  (não só grade) — formas e padrões.

### F.4. Mais hazards e power-ups — `P2` · `S`
- Power-down ocasional (encolhe paddle), bola extra-rápida, gravidade. Equilibra
  o "só upside" atual.

---

## Parte G — Block Drop 🟧

**Estado atual:** puzzle de peças caindo com combo *Overdrive*, controle por
swipe, 5 troféus, pontos infinitos.

### G.1. Ghost piece + hold/next — `P1` · `S` — ✅ FEITO (2026-06-04, hold)
- Sombra de aterrissagem (ghost) e, se ainda não houver, fila "próxima" + "segurar
  peça". Padrão esperado do gênero; melhora muito a legibilidade no celular.
- **Implementado:** o **ghost** e o preview "próxima" já existiam; adicionado o
  **hold/reserva** (botão de ação, 1× por peça, com preview ao lado da "próxima",
  esmaecido enquanto bloqueado).

### G.2. Aprofundar o Overdrive — `P1` · `M`
- Multiplicador de cadeia, shard-bomba ao encher, "all clear" bônus. É a mecânica
  assinatura — vale dar profundidade.

### G.3. Modos de jogo — `P2` · `M`
- Sprint (40 linhas no menor tempo), Ultra (pontos em 2 min), piso subindo
  (garbage). Reaproveita o leaderboard com `scoreType` por modo.

---

## Sequenciamento sugerido (milestones)

**M1 — Fundação de controles (desbloqueia o resto)**
1. A1 (botões de ação + `isButtonHeld`) `P0`
2. A3 (reiniciar no pause) `P1` — barato e muito sentido
3. A2 (haptics + clique configurável) `P1`

**M2 — Os pedidos do A, jogo a jogo** — ✅ CONCLUÍDO (2026-06-04)
4. B1 (River Run: tiro opcional + míssil) `P0` — ✅
5. E.1/E.2 (Star Defender: tiro/Nova manual, reusa B1) `P1` — ✅
6. D.1 (Road Burner: nitro manual + drift) `P1` — ✅
7. C.1 / F.1 / G.1 (dash, disparo de Blaze, ghost piece) `P1` — ✅

**M3 — Profundidade de conteúdo**
8. Chefes/variedade: B2, E.3, F.2, F.3
9. Hazards/variedade: C.2, D.2, E.4
10. A4 (resumo de run + progresso de troféus)

**M4 — Meta e rejogabilidade**
11. A5 (dificuldades), A6 (desafio diário), G.3/D.3 (modos/rival)

---

## Notas de implementação (riscos/decisões)

- **A1 é o gargalo de dependência** — fazer primeiro e bem-testado; metade do M2
  encosta nele. Manter os botões **declarativos no `GameMeta`** para não vazar
  lógica de jogo para o shell.
- **Auto-fire vs manual:** transformar comportamento default mexe na "sensação"
  de River Run/Star Defender; manter toggle de acessibilidade e validar feel com
  playtests (smoke headless não cobre "gostoso de jogar").
- **Haptics:** iOS Safari não tem `navigator.vibrate` → tratar como enhancement,
  nunca como dependência de gameplay.
- **Originalidade/escopo:** chefes e padrões devem ter arte/áudio originais; nada
  copiado das obras de referência.
