# Empires of Civilization

RTS medieval 2D isométrico para navegador, inspirado nos clássicos do gênero, com identidade, nomes e gráficos originais.

> **Estado atual: Fase 4 (produção militar e combate) concluída.** Mapa procedural isométrico, câmera RTS, pathfinding A*, coleta de recursos, construção de edifícios, treinamento de unidades e combate (corpo a corpo, arqueiros com projéteis, posturas, ataque-mover, destruição de edifícios). O adversário ainda **não** tem IA (Fase 5); um modo de teste permite controlar os dois lados. Multiplayer ainda não implementado — veja [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Requisitos

- Node.js **20.19+** (recomendado 22 LTS — ver `.nvmrc`)
- npm 10+
- Navegador moderno com WebGL (Chrome, Firefox ou Edge)

## Instalação

```bash
npm install
```

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o cliente em modo desenvolvimento em http://127.0.0.1:5173 |
| `npm test` | Testes unitários (Vitest) da simulação e do cliente |
| `npm run test:e2e` | Testes de interface (Playwright). Primeira vez: `npx playwright install chromium` |
| `npm run typecheck` | Verificação de tipos de todos os pacotes |
| `npm run build` | Verificação de tipos + build de produção em `apps/client/dist` |
| `npm run preview` | Serve o build de produção localmente |

Servidor, banco de dados e migrations ainda não existem (Fase 7) — não há comandos para eles por enquanto.

## Como jogar (Fase 4)

1. `npm run dev` e abra http://127.0.0.1:5173.
2. **Jogar** → escolha tamanho do mapa e semente → **Iniciar partida**.
3. Selecione unidades (clique / arrastar) e clique com o botão direito para movê-las.
4. Com aldeões selecionados, clique com o botão direito em uma árvore, mina ou arbusto: eles coletam, levam ao Centro da Vila e voltam sozinhos. A tecla `.` seleciona o próximo aldeão ocioso.
5. Com aldeões selecionados, pressione **B** (ou o botão Construir), escolha o edifício e clique no mapa onde a área ficar verde. Shift mantém o modo para posicionar várias obras em fila.
6. Selecione o Centro da Vila, o Quartel ou o Campo de Arqueiros para treinar unidades (botões ou Q/E). Botão direito com o edifício selecionado define o ponto de reunião.
7. Botão direito em um inimigo ataca; **A** + clique faz atacar-mover; **H** mantém posição.
8. Para testar combate antes da IA, marque **Modo de teste** na tela de nova partida e use **F9** para alternar entre os jogadores.

Controles completos em **Tutorial e controles** no menu principal ou em [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md#controles).

## Estrutura

```text
apps/client          React + Phaser (menus, HUD, renderização, entrada)
packages/shared      Tipos, comandos e constantes comuns a cliente e servidor
packages/game-data   Dados de balanceamento (unidades, edifícios, terrenos, recursos)
packages/simulation  Lógica de jogo pura (sem DOM/Phaser): mapa, A*, movimento, economia, construção, treinamento, combate, comandos
docs/                Arquitetura, design, desenvolvimento e implantação
```

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Game design](docs/GAME_DESIGN.md)
- [Desenvolvimento e pendências](docs/DEVELOPMENT.md)
- [Implantação](docs/DEPLOYMENT.md)
- [Guia de estilo de arte](docs/ART_STYLE_GUIDE.md)
