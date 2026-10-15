# Game Design

> Valores numéricos ficam em `packages/game-data/src` e podem ser ajustados sem mexer na lógica.
> Itens marcados com *(planejado)* ainda não estão implementados.

## Início de partida

Cada jogador começa com **Centro da Vila**, **5 aldeões**, **1 batedor** e:

| Comida | Madeira | Ouro | Pedra |
| --- | --- | --- | --- |
| 200 | 200 | 100 | 200 |

Limite populacional inicial: 10 (fornecido pelo Centro da Vila).

## Mapas

- Tamanhos: Pequeno 64×64, Médio 128×128, Grande 256×256.
- Gerados proceduralmente a partir de uma **semente** (mesma semente → mesmo mapa).
- Terrenos: gramado, floresta, terra, areia, rochas, montanha (intransitável), água (intransitável), vau e estrada.
- Velocidade por terreno: estrada 125%, gramado/terra 100%, floresta/areia 90%, rochas 85%, vau 60%.
- Rios opcionais; estradas ligam as bases e criam **vaus** ao cruzar água.
- Validação automática: conectividade entre bases, área livre para o Centro da Vila e recursos mínimos acessíveis perto de cada base (≥5 ouro, ≥4 pedra, ≥4 arbustos, ≥15 árvores a 16 tiles). Mapas reprovados são regerados de forma determinística.

## Recursos naturais

| Fonte | Recurso | Quantidade |
| --- | --- | --- |
| Árvore | Madeira | 100 |
| Mina de Ouro | Ouro | 800 |
| Mina de Pedra | Pedra | 350 |
| Arbusto Frutífero | Comida | 125 |

### Coleta

| Fonte | Velocidade (por segundo) |
| --- | --- |
| Árvore | 0,42 |
| Mina de Ouro | 0,38 |
| Mina de Pedra | 0,36 |
| Arbusto Frutífero | 0,33 |

- Capacidade de carga do aldeão: **10**.
- Ciclo automático: ir à fonte → coletar até encher → levar ao **depósito mais próximo que aceite o recurso** → voltar à mesma fonte.
- Depósitos: **Centro da Vila** (os quatro recursos), **Depósito de Madeira** (madeira) e **Depósito de Mineração** (ouro e pedra).
- Fonte esgotada é removida do mapa (o terreno fica livre). O aldeão procura outra do mesmo tipo a até **8 tiles**; se não houver, deposita o que carrega e fica ocioso.
- Árvores mostram o tronco derrubado assim que começam a ser cortadas.
- Ordenar a coleta de outro tipo de recurso **descarta** a carga atual (comportamento clássico do gênero).
- Recursos são finitos; não há fontes renováveis por enquanto (fazendas na Fase 3).
- Tecnologias e civilizações poderão alterar velocidade de coleta e capacidade de carga (`modifiers`).

## Unidades

| Unidade | Vida | Ataque | Armadura (c/d) | Velocidade | Visão | Custo |
| --- | --- | --- | --- | --- | --- | --- |
| Aldeão | 25 | 3 | 0/0 | 1,5 | 4 | 50 comida |
| Batedor | 45 | 3 | 0/2 | 2,7 | 8 | 80 comida |

Demais unidades (espadachim, lanceiro, arqueiro, cavaleiro, aríete, catapulta): *(planejado — Fases 4 e 6)*.

## Edifícios

| Edifício | Vida | Tamanho | Custo | Tempo | Função |
| --- | --- | --- | --- | --- | --- |
| Centro da Vila | 2400 | 4×4 | 275 madeira, 100 pedra | 150 s | +10 população; recebe todos os recursos; construível só a partir da Era III |
| Casa | 550 | 2×2 | 25 madeira | 25 s | +5 população |
| Depósito de Madeira | 1000 | 2×2 | 100 madeira | 35 s | Recebe madeira |
| Depósito de Mineração | 1000 | 2×2 | 100 madeira | 35 s | Recebe ouro e pedra |
| Quartel | 1200 | 3×3 | 175 madeira | 50 s | Treinamento de infantaria *(Fase 4)* |

Limite absoluto de população: 200.

### Construção

1. Selecione aldeões e abra o menu **Construir** (B).
2. Escolha o edifício (C, M, O, Q). Uma prévia segue o cursor; a área fica **verde** quando é válida e **vermelha** onde houver obstáculo, terreno impróprio (água, montanha, rochas, estrada, vau) ou unidade de outro jogador.
3. Clique para posicionar: o custo é cobrado na hora e os aldeões vão até a obra. **Shift** mantém o modo e coloca as obras na fila dos aldeões.
4. A obra sobe aos poucos, com barra de progresso. Mais aldeões aceleram com retorno decrescente: tempo = 3·T / (N + 2). Exemplos: 1 aldeão = T; 2 = 0,75·T; 4 = 0,5·T.
5. Ao concluir, quem construiu um depósito começa a coletar o recurso correspondente mais próximo.

- Clique direito em obra própria com aldeões selecionados: ajudar a construir.
- **Delete** em obra própria selecionada: cancela e devolve o custo proporcional ao que falta.
- Recursos insuficientes, era ou pré-requisitos ausentes desabilitam o botão e mostram o motivo.

Demais edifícios (campo de arqueiros, estábulo, ferreiro, mercado, muralha, torre, oficina de cerco, castelo, fazenda): *(planejado — Fases 4 a 6)*.

## Civilizações

Nomes já usados na interface: **Reino de Valdoria** (jogador) e **Império de Arkan** (rival). Bônus, unidades especiais e estilos: *(planejado — Fase 6)*.

## Eras

1. Era dos Assentamentos (atual) · 2. Era dos Reinos · 3. Era das Fortalezas · 4. Era dos Impérios — evolução *(planejado — Fase 6)*.

## Combate, tecnologias, vitória

*(planejado — Fases 4 a 6)*. Veja a especificação em `DEVELOPMENT.md`.

## Controles

| Entrada | Ação |
| --- | --- |
| Clique esquerdo | Selecionar |
| Arrastar (esquerdo) | Seleção em área (apenas unidades próprias) |
| Shift + clique/arrasto | Adicionar/remover da seleção |
| Duplo clique | Selecionar unidades visíveis do mesmo tipo |
| Clique direito no terreno | Mover |
| Clique direito em recurso | Aldeões coletam (demais unidades se movem até lá) |
| Clique direito no Centro da Vila | Aldeões com carga depositam |
| Clique direito em obra própria | Ajudar a construir |
| B | Menu de construção |
| C / M / O / Q | Casa / Depósito de Madeira / Depósito de Mineração / Quartel (com o menu aberto) |
| Shift ao posicionar | Enfileirar várias obras |
| Delete | Cancelar obra selecionada |
| . (ponto) | Próximo aldeão ocioso |
| S | Parar (com unidades próprias selecionadas; senão, câmera para baixo) |
| Esc | Cancelar posicionamento / fechar menu / limpar seleção |
| Espaço | Centralizar câmera na seleção |
| Ctrl + 0–9 | Criar grupo de controle |
| 0–9 / duas vezes | Selecionar grupo / centralizar |
| WASD, setas | Mover câmera |
| Roda do mouse | Zoom (mantém o ponto sob o cursor) |
| Botão do meio | Arrastar câmera |
| Bordas da tela | Rolagem (desativável) |
| Minimapa | Clique/arraste para mover a câmera |
| F10 | Menu da partida (pausa) |
