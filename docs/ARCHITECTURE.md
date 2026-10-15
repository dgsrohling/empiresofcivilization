# Arquitetura

## Visão geral

Monorepositório TypeScript com *npm workspaces*. Os pacotes são consumidos diretamente como código-fonte TS (sem etapa de build própria); o Vite e o Vitest compilam sob demanda.

```text
@eoc/shared  ◄──  @eoc/game-data  ◄──  @eoc/simulation  ◄──  @eoc/client
 tipos/comandos     balanceamento        regras puras          React + Phaser
```

A regra principal: **`@eoc/simulation` não importa nada de DOM, React ou Phaser.** Ela pode rodar no navegador, no Node (testes) e futuramente no servidor autoritativo.

## Módulos da simulação (`packages/simulation/src`)

| Pasta | Responsabilidade |
| --- | --- |
| `core/rng.ts`, `core/noise.ts` | Aleatoriedade determinística (mulberry32) e value noise / fBm |
| `core/World.ts` | Estado da partida: entidades, jogadores, grade de navegação, ocupação estática |
| `core/Simulation.ts` | Loop de passo fixo e fila de comandos |
| `core/createMatch.ts` | Monta a partida (mapa, Centro da Vila, unidades iniciais) |
| `map/` | Geração procedural e validação de mapas |
| `pathfinding/` | `NavGrid` (custos, componentes conexos), `AStar`, suavização por linha de visão, `PathService` (fila + cache) |
| `spatial/SpatialHash.ts` | Consultas de proximidade sem alocação por frame |
| `movement/` | Seguir caminho, deslizamento em obstáculos, detecção de bloqueio, separação, formação de grupo |
| `economy/` | Ciclo de coleta/depósito dos aldeões (`EconomySystem`) e consultas (fonte mais próxima, depósito mais próximo, ponto de aproximação) |
| `construction/` | Validação de posicionamento (`checkPlacement`, compartilhada com a prévia do cliente) e obras (`ConstructionSystem`) |
| `orders/` | Comportamentos comuns a várias ordens (aproximar-se de um alvo, alcance de interação) |
| `combat/` | Regras de dano (`damage.ts`) e `CombatSystem` (perseguição, ataques, projéteis, busca de alvos, posturas, mortes) |
| `training/` | `TrainingSystem` (filas, população, nascimento e ponto de reunião) |
| `commands/` | Validação de comandos (propriedade, existência, limites) |

## Ciclo de simulação

- Taxa fixa: **20 ticks/s** (`TICK_RATE`, `packages/shared/src/constants.ts`).
- A cena Phaser acumula o tempo real e executa `sim.step()` quantas vezes forem necessárias (limite de 250 ms por quadro, evitando a "espiral da morte" após a aba ficar inativa).
- Em cada `step()`:
  1. salva `prevX/prevY` de cada unidade (para interpolação);
  2. aplica os comandos enfileirados (revalidados);
  3. processa até *N* pedidos de caminho (orçamento por tick);
  4. avança as filas de treinamento (novas unidades nascem aqui);
  5. move unidades e resolve sobreposição;
  6. atualiza a economia (coleta, depósito, troca de alvo);
  7. atualiza obras e reparos;
  8. combate: ataques, projéteis, busca automática de alvos e, no fim, as mortes do tick;
  9. unidades sem tarefa que terminaram o deslocamento ficam ociosas;
  10. avança `tick` e `time`.
- A renderização interpola entre `prev` e posição atual com `alpha = acumulador / TICK_MS`, então o movimento é suave a 30, 60 ou 144 FPS.

## Fluxo de comandos

```text
Mouse/teclado → InputController → GameSession.issue() → Simulation.issue()
                                                         ├─ validateCommand()  (rejeição imediata → feedback no HUD)
                                                         └─ fila → aplicado no próximo tick
```

O cliente nunca altera entidades diretamente. O mesmo `validateCommand` será executado pelo servidor autoritativo na Fase 7 (o cliente apenas enviará `GameCommand`s).

## Ordens, movimento e tarefas

- O `MovementSystem` só desloca: recebe um destino, publica `moveStatus` (`moving`, `arrived`, `failed`) e nunca decide o que a unidade faz depois.
- Quem dá ordens (comandos, `EconomySystem`, futuramente combate e construção) lê esse status. Uma unidade tem no máximo uma `task` (hoje: `GatherTask`).
- `unit.state` (`idle`, `moving`, `gathering`, `building`, `attacking`) é a atividade visível usada por HUD e animações.
- Tarefas: `GatherTask`, `BuildTask`, `RepairTask` e `AttackTask`.
- `unit.buildQueue` guarda obras enfileiradas (Shift); qualquer outra ordem a esvazia.

## Economia

Ciclo da `GatherTask`: `toResource` → `gathering` → `toDropsite` → (volta a `toResource`).

- **Aproximação:** a unidade vai ao centro de um tile vizinho ao recurso/edifício, escolhido por distância e penalizando tiles já ocupados/reservados por outras unidades (espalha grupos).
- **Alcance:** interage quando a distância até a borda do alvo é ≤ `ECONOMY.interactionReach` (com folga para empurrões).
- **Quantidades inteiras:** cada unidade sai da fonte e entra na carga; ao depositar, sai da carga e entra no estoque — conservação coberta por teste a cada tick.
- **Esgotamento:** a fonte é removida (`World.removeEntity`), o tile é liberado na `NavGrid` (invalida o cache de caminhos) e a unidade procura a fonte do mesmo tipo mais próxima e **acessível** em `ECONOMY.retargetRadius`.
- **Depósito:** edifício concluído do jogador com `dropsiteFor` contendo o recurso (hoje, Centro da Vila). Sem depósito: o aldeão para com a carga e um evento `noDropsite` é emitido.
- **Modificadores:** `PlayerState.modifiers` (multiplicador de coleta por recurso e bônus de carga) — ponto de entrada para tecnologias e civilizações.

## Construção

- **Posicionamento:** `checkPlacement(world, jogador, tipo, x, y)` verifica disponibilidade (era, pré-requisitos, recursos), limites do mapa, terreno edificável, ausência de objetos estáticos e de unidades de outros jogadores, e devolve os tiles inválidos. O cliente usa a mesma função para pintar a prévia, então o que aparece verde é exatamente o que a simulação aceita.
- **Fundação:** ao posicionar, o custo é cobrado, a obra é criada com 1 de vida e progresso 0 e já bloqueia a grade. Unidades próprias dentro da área são afastadas para o tile livre mais próximo; caminhos que passavam pela área são recalculados (o `MovementSystem` revalida as rotas quando `NavGrid.version` muda).
- **Progresso:** com N construtores ao alcance, a obra avança `(N + 2) / (3·T)` por segundo (T = tempo de construção), multiplicado por `modifiers.buildSpeed`. A vida cresce proporcionalmente.
- **Conclusão:** o limite populacional aumenta, e o depósito passa a aceitar recursos (obras não concluídas nunca recebem). Cada construtor segue para a próxima obra da fila; quem conclui um depósito especializado começa a coletar o recurso correspondente mais próximo.
- **Cancelamento:** devolve `floor(custo × (1 − progresso))` e libera a área.

## Treinamento

- O custo é cobrado ao enfileirar (máximo de 10 itens) e devolvido integralmente ao cancelar.
- O item da frente só começa se houver população disponível (limite = casas + Centros da Vila, no máximo 200); caso contrário a fila para e um evento `trainingBlocked` é emitido uma vez.
- A unidade nasce no tile livre ao redor do edifício mais próximo do ponto de reunião. Se o ponto de reunião for um recurso, aldeões começam a coletá-lo; senão, a unidade caminha até lá.

## Combate

- **Dano:** `max(1, ataque − armadura do tipo + bônus contra a categoria do alvo)`. Corpo a corpo usa a armadura `melee`; flechas usam `pierce`. Edifícios têm a categoria `building`.
- **Alcance:** medido entre as bordas (raio das unidades, retângulo dos edifícios). Corpo a corpo tem alcance efetivo de 0,2 tile.
- **Corpo a corpo** aplica o dano na hora. **À distância** cria um `Projectile` em `world.projectiles`, que persegue o alvo e aplica o dano calculado no disparo ao chegar (se o alvo morrer antes, a flecha se perde).
- **Busca automática:** unidades militares sem tarefa procuram, a cada 0,5 s, o inimigo mais próximo no campo de visão (em "manter posição", só no alcance), priorizando quem as atacou e unidades sobre edifícios. Unidades em movimento comum ignoram inimigos; em ataque-mover, não.
- **Posturas:** agressiva (persegue até 14 tiles do ponto de guarda), defensiva (até 5 tiles e volta ao ponto de guarda), manter posição (não se move). Ordens explícitas de ataque perseguem sem limite.
- **Mortes:** acumuladas durante o tick e processadas no fim (`entityDied` + `World.removeEntity`), para não alterar listas durante as iterações. Edifícios destruídos liberam a área e reduzem o limite populacional.
- **Inimigos:** `areEnemies(a, b)` — jogadores diferentes são inimigos, a natureza é neutra. Times virão com o multiplayer.

## Eventos da simulação

A simulação acumula `SimEvent`s (`entityRemoved`, `resourceTouched`, `deposited`, `noDropsite`, `buildingPlaced`, `buildingCompleted`, `buildingCancelled`, `entityDied`, `attacked`, `meleeHit`, `projectileFired`, `projectileHit`, `unitTrained`, `trainingBlocked`, `repairStopped`); o cliente os consome com `sim.drainEvents()` a cada quadro para remover sprites, trocar a árvore pela textura cortada, mostrar "+10" e avisos. O mesmo canal servirá para áudio e para o envio de deltas na rede.

## Pathfinding

- **Grade:** 1 célula por tile. Custo = `1 / speedMultiplier` do terreno; objetos estáticos (edifícios, árvores, minas) marcam o tile como bloqueado. Unidades não bloqueiam a grade.
- **A\*:** 8 direções, heurística octile escalada pelo menor custo do mapa (admissível), proibição de cortar quinas, buffers reaproveitados por carimbo de geração e heap binária com *lazy deletion*.
- **Destino inalcançável:** componentes conexos (recalculados só quando a grade muda) permitem escolher o tile alcançável mais próximo **antes** de rodar o A*, evitando buscas exaustivas.
- **Suavização:** *string pulling* com teste de linha de visão que considera o raio da unidade.
- **Fila e cache:** `PathService` processa até 24 pedidos por tick; caminhos de tiles são cacheados (LRU, 512) e invalidados quando `NavGrid.version` muda.
- **Grupos:** `distributeDestinations` cria vagas em anéis ao redor do alvo (mesmo componente e com linha de visão até o centro) e atribui a vaga mais próxima a cada unidade.
- **Bloqueios:** se a unidade progride < 20% do esperado em 1 s, o caminho é recalculado (até 3 vezes).
- **Pendente:** navegação hierárquica para mapas grandes, campos de fluxo para grandes grupos.

## Renderização (`apps/client/src/game`)

- **Projeção:** isométrica 2:1, tile 64×32 px (`iso.ts`).
- **Terreno:** um `Blitter` do Phaser por bloco de 16×16 tiles (uma chamada de desenho por bloco); blocos fora da câmera ficam invisíveis.
- **Objetos:** `Image`s com profundidade = Y de tela do ponto de apoio. Objetos estáticos são agrupados em blocos para *culling*.
- **Sobreposições:** dois `Graphics` (abaixo e acima das entidades) para seleção, barras de vida, marcadores de destino, caminhos e retângulo de seleção.
- **Texturas:** geradas proceduralmente em canvas (`proceduralTextures.ts`, primitivas em `art/primitives.ts`, edifícios em `art/buildings.ts`) com chaves estáveis (`textureKeys.ts`). As dimensões de cada edifício derivam da área ocupada (`buildingArt`). Para trocar pela arte definitiva, carregue imagens com as mesmas chaves e pontos de apoio (ver `docs/ART_STYLE_GUIDE.md`).
- **Obras:** o sprite do edifício é recortado de baixo para cima conforme o progresso, sobre uma fundação desenhada no chão, com barra de progresso.
- **Posicionamento:** `PlacementController` mostra o edifício semitransparente preso à grade e pinta cada tile da área de verde ou vermelho.
- **Efeitos de combate:** `EffectsRenderer` desenha flechas (interpoladas, em arco), impactos, corpos que tombam e escombros, a partir dos projéteis e eventos da simulação.

## Interface (React)

- React cuida de menus e HUD; **não** recebe posições de unidades a cada quadro.
- A cena publica um *snapshot* do HUD no Zustand a cada 200 ms (`hudStore`).
- O minimapa desenha diretamente em canvas a cada 100 ms, lendo o estado da simulação.
- `GameSession` é a ponte: cria a simulação e o `Phaser.Game`, expõe ações de alto nível (parar, centralizar, mover câmera) e é destruída ao sair/reiniciar (sem recarregar a página).

## Separação cliente/servidor (planejada)

- Fase 7: `apps/server` (Node + Socket.IO) executará `@eoc/simulation` como autoridade; clientes enviam `GameCommand` e recebem snapshots/deltas filtrados pelo fog of war.
- A simulação já é determinística para a mesma seed e sequência de comandos (coberto por teste), facilitando reconexão e replays.
