# Desenvolvimento

## Estado das fases

| Fase | Status |
| --- | --- |
| 1 — Protótipo visual | ✅ Concluída |
| 2 — Sistema econômico | ✅ Concluída |
| 3 — Construções | ✅ Concluída |
| 4 — Produção militar e combate | ✅ Concluída |
| 5 — IA | ⏳ Próxima |
| 6 — Expansão (eras, tecnologias, civilizações) | Pendente |
| 7 — Multiplayer | Pendente |
| 8 — Polimento e implantação | Pendente |

## Fase 1 — o que está implementado

- Monorepo TypeScript (npm workspaces): `client`, `shared`, `game-data`, `simulation`.
- React + Phaser 3 + Vite + Tailwind CSS 4 + Zustand.
- Simulação de passo fixo (20 Hz) desacoplada da renderização, com interpolação.
- Geração procedural determinística de mapas (64/128/256) com terrenos variados, rios, estradas/vaus, florestas e recursos; validação de conectividade e recursos iniciais.
- Renderização isométrica com terreno em blocos (Blitter) e *culling* de terreno, objetos e unidades.
- Câmera: WASD/setas, bordas (desativável), botão do meio, zoom no cursor, limites do mapa, centralizar na seleção, minimapa clicável.
- Seleção: clique, arrasto, Shift, duplo clique por tipo, grupos de controle (Ctrl+N / N / N duas vezes), Esc.
- Comandos: mover (clique direito) e parar (S / botão), validados pela simulação (propriedade, existência, limites).
- Pathfinding A* com fila/orçamento, cache, suavização, destino inalcançável resolvido por componentes conexos, distribuição de destinos para grupos, detecção de bloqueio e separação entre unidades.
- HUD: recursos, população, era, tempo, minimapa (aliados/inimigos/câmera), painel de seleção (vida, ataque, armadura, alcance, velocidade, visão, estado), painel de comandos, notificações.
- Menus: principal, nova partida (tamanho + semente), configurações persistidas, tutorial/controles, créditos, menu da partida com pausa, reinício (mesmo mapa / novo mapa) e saída sem recarregar a página.
- Gráficos provisórios originais gerados proceduralmente.

## Fase 2 — o que está implementado

- Comandos `gather` e `deposit`, validados (somente aldeões próprios; alvo precisa ser recurso com saldo / depósito próprio concluído).
- `EconomySystem`: ciclo coleta → depósito → retorno; capacidade de carga; depósito no edifício aceito mais próximo; troca automática para fonte vizinha do mesmo tipo quando a atual se esgota; redirecionamento quando a árvore clicada está cercada; vários aldeões na mesma fonte com distribuição dos pontos de coleta.
- Remoção de fontes esgotadas (libera o tile para navegação) e eventos da simulação consumidos pelo cliente.
- Modificadores por jogador (velocidade de coleta, capacidade de carga) e estatísticas de recursos coletados.
- Refatoração do movimento: `moveStatus` separado das tarefas.
- Interface: clique direito contextual (coletar/depositar/mover) com cursor indicativo e destaque do alvo; animação de coleta; ícone da carga sobre o aldeão; árvore derrubada; "+N" ao depositar; aldeões por recurso e botão de aldeões ociosos (tecla `.`) na barra superior; painel **Economia** (estoque, aldeões, total coletado, ritmo do último minuto); carga e tarefa no painel de seleção; botão "Depositar"; minimapa atualizado quando fontes somem.

## Fase 3 — o que está implementado

- Edifícios novos com dados de balanceamento: Casa, Depósito de Madeira, Depósito de Mineração e Quartel. O Centro da Vila passa a ter regra de construção (Era III).
- Comandos `placeBuilding` (com fila via Shift), `construct` (ajudar obra) e `cancelBuilding`, todos validados na simulação.
- Validação de posicionamento compartilhada entre simulação e prévia: limites, terreno edificável, objetos estáticos, unidades de outros jogadores, era, pré-requisitos e recursos, com a lista de tiles inválidos.
- `ConstructionSystem`: custo cobrado ao posicionar, fundação bloqueando a grade, aproximação dos construtores, progresso com fórmula de vários construtores, vida proporcional, conclusão (população, depósito ativo), fila de obras, construtor de depósito passa a coletar, cancelamento com devolução proporcional.
- Unidades próprias dentro da área da obra são afastadas; caminhos que cruzam a nova obra são recalculados.
- Refatoração: aproximação de alvos compartilhada entre economia e construção (`orders/approach.ts`); arte procedural dividida em `art/primitives.ts` e `art/buildings.ts`.
- Interface: menu de construção (B) com ícones, custos, atalhos e motivo de indisponibilidade; prévia semitransparente com tiles verdes/vermelhos; aviso do modo de posicionamento; obra que "sobe" com barra de progresso; status "Construindo Casa (+1 na fila)"; cancelar obra (Delete/botão); clique direito em obra para ajudar; avisos de obra concluída/cancelada.
- Guia de estilo de arte: `docs/ART_STYLE_GUIDE.md`.

## Fase 4 — o que está implementado

- Unidades: espadachim, lanceiro, arqueiro (além de aldeão e batedor), com dados de combate configuráveis (dano, tipo de dano, bônus por categoria, alcance, recarga, projétil, busca automática).
- Edifício novo: Campo de Arqueiros (requer Quartel). Centro da Vila treina aldeões; Quartel, espadachins e lanceiros.
- `TrainingSystem`: filas com custo antecipado, limite de 10, bloqueio por população com aviso, cancelamento com devolução integral, nascimento ao lado do edifício e ponto de reunião (inclusive em recurso).
- `CombatSystem`: perseguição com recálculo periódico de rota, corpo a corpo, flechas como projéteis teleguiados, armadura e bônus, busca automática de alvos, posturas (agressiva, defensiva, manter posição), ataque-mover, revide, mortes processadas no fim do tick, destruição de edifícios (libera a área e reduz a população máxima), estatísticas (abates, perdas).
- Reparo de edifícios com custo proporcional e parada por falta de recursos.
- Interface: botões de treinamento com custo, tempo e motivo de indisponibilidade; fila com progresso e cancelamento; clique direito para atacar, reparar e definir ponto de reunião; atacar-mover (A); manter posição (H) e botões de postura; barras de vida para quem sofreu dano; alerta "Você está sendo atacado!" com marca no minimapa; avisos de edifício destruído e de população máxima.
- Arte e efeitos: soldados, flechas em arco, faíscas de impacto, corpos que tombam, escombros com poeira, Campo de Arqueiros.
- **Modo de teste:** opção na nova partida que permite controlar os dois jogadores (F9), para testar combate antes da IA.

## Testes

- **Unitários (Vitest, 103):** RNG, A*, NavGrid/componentes, suavização, PathService (fila, cache, inalcançável), geração/validação de mapas em vários tamanhos e seeds, criação de partida, validação de comandos, movimento sem atravessar obstáculos, separação, determinismo, formação, projeção isométrica, seleção, formatação. **Economia:** ciclo completo com conservação verificada a cada tick, capacidade, depósito mais próximo, esgotamento e troca de alvo, ausência de depósito, troca de tipo de recurso, comando de depósito, árvore cercada, vários aldeões na mesma fonte, modificadores, cancelamento por movimento, validação, integração em mapa procedural (os 4 recursos aumentam em 3 min) e determinismo com coleta; ritmo de coleta do HUD. **Construção:** validação de posição (limites, água, sobreposição, recursos, unidades inimigas e próprias, era), validação do comando, custo e fundação, tempo com 1 construtor, aceleração com vários, ajuda em obra, cancelamento com devolução, proibições de cancelamento, depósito só ativo após conclusão, construtor de depósito passa a minerar, fila com Shift, ordem que limpa a fila, afastamento de unidades e recálculo de rotas, e integração em mapa procedural (casa + quartel). **Combate:** fórmula de dano e bônus, morte e estatísticas, lanceiro × batedor, projéteis com tempo de voo, busca automática, movimento × ataque-mover, manter posição, postura defensiva, revide, destruição de edifício, validação, batalha sem unidades em tiles bloqueados e determinística. **Treinamento:** custo e nascimento, fila em sequência, bloqueio por população, cancelamento, validação, ponto de reunião em recurso e no terreno, pré-requisito do Campo de Arqueiros. **Reparo:** custo, conclusão e parada sem recursos. **Critério da fase:** dois jogadores treinam exércitos e combatem até um lado ser derrotado.
- **E2E (Playwright, 7):** seleciona um aldeão com o mouse, move com clique direito e verifica que ele nunca pisa em tile bloqueado e chega ao destino; seleção por arrasto, grupos de controle, pausa pelo menu, reinício sem recarregar e saída para o menu; aldeão coleta comida com clique direito em um arbusto e o total da barra superior aumenta (simulação acelerada 8× via `window.__EOC__.timeScale`); aldeão constrói uma casa pelo menu (B → C → clique), a obra é posicionada no tile escolhido, o custo é cobrado e o limite populacional passa de 10 para 15; Centro da Vila treina aldeões pela tecla Q e pelo botão; combate com clique direito (espadachim mata aldeão) e atacar-mover (arqueiro mata lanceiro, com flechas em voo); modo de teste alterna o jogador com F9. Capturas de tela ficam em `test-results/`.

## Pendências e decisões em aberto

- **Fog of war** (seção 5): não implementado; todo o mapa está visível. Previsto junto à IA/multiplayer, pois afeta o que o servidor envia.
- Tecla **S** é compartilhada entre "Parar" e câmera (WASD). Hoje: com unidades próprias selecionadas, S = parar. Futuramente: atalhos configuráveis (também resolverá A = ataque-movimento).
- **Ctrl + número**: alguns navegadores/SOs podem reservar o atalho (troca de abas). Se ocorrer, será adicionado um atalho alternativo.
- Salvamento/carregamento (IndexedDB), áudio, animações por spritesheet, navegação hierárquica: pendentes.
- Velocidade de jogo: existe `timeScale` na sessão (usado nos testes), mas ainda não há controle na interface.
- Animais para caça e pesca: não implementados (fonte de comida atual: arbustos).
- **Fazenda:** prevista na especificação (seção 8), mas fora da lista da Fase 3; fica para a Fase 6 junto com as melhorias econômicas.
- **Condições de vitória/derrota:** a simulação ainda não declara vencedor; chegam na Fase 5 junto com a IA.
- **Fog of war:** ainda não implementado.
- **Torres, cavalaria (estábulo), cerco e muralhas:** Fase 6.
- **Centro da Vila** não atira flechas nem abriga aldeões (guarnição): pendente.
- Muralhas (posicionamento arrastando em linha) e demais edifícios: Fases 4 a 6.
- Tecla **A** também é câmera para a esquerda: com unidades militares selecionadas ela vira atacar-mover (mesma regra do S). Atalhos configuráveis seguem pendentes.

## Problemas conhecidos

- O tamanho do pacote do Phaser (~1,2 MB, ~330 KB gzip) gera um chunk grande; aceitável para jogo, pode ser otimizado com *lazy loading* da cena.
- Transições entre terrenos são bordas retas (sem *blending*).
- Unidades não colidem entre si no planejamento (apenas separação local); grandes grupos em corredores estreitos podem se empurrar.
- Muitos aldeões na mesma fonte 1×1 disputam os 8 tiles vizinhos; acima disso, alguns ficam em espera empurrando-se até uma vaga liberar ou mudam para uma fonte próxima.

## Convenções

- Lógica de jogo apenas em `packages/simulation` (sem DOM). Dados numéricos em `packages/game-data`.
- Toda aleatoriedade da simulação via `Rng` (nunca `Math.random`).
- Comandos são a única forma de o jogador alterar a simulação.
- UI em português; identificadores de código em inglês; comentários em português.
