# Guia de Estilo de Arte

Referência para produzir (ou pedir a uma IA) as artes definitivas do jogo. Este guia cobre só o que **já está definido** no jogo. A especificação completa de unidades animadas, edifícios militares e efeitos virá depois da Fase 4, junto com o carregador de artes.

---

## 1. Regras que valem para todas as imagens

| Regra | Valor |
| --- | --- |
| Projeção | Isométrica **2:1** (dimétrica). Uma linha do chão sobe 1 px a cada 2 px na horizontal (≈ 26,6°). Sem perspectiva nem ponto de fuga. |
| Câmera | Olhando de cima a cerca de 30°, girada 45° em relação ao mapa. A frente dos objetos aponta para baixo à direita e para baixo à esquerda. |
| Luz | Vem do **alto à esquerda**. Faces voltadas para a esquerda são mais claras; faces voltadas para a direita, mais escuras. |
| Sombra | Elipse suave no chão, ~25–30% de preto, deslocada levemente para a direita. Sem sombras longas projetadas. |
| Fundo | **Transparente** (PNG com canal alfa). Nada de chão, grama ou céu atrás do objeto. |
| Resolução de entrega | **2×** o tamanho final da tabela da seção 3. O jogo reduz pela metade, e a imagem continua nítida com zoom de até 2×. |
| Legibilidade | O jogo é visto de longe e em tamanho pequeno. Silhuetas claras, poucos detalhes finos, contraste entre o objeto e a grama. |
| Cor do jogador | Áreas que mudam de cor por jogador (bandeiras, faixas, telhado de estandarte) devem ser pintadas em **cinza neutro** e entregues também como uma **máscara** separada (branco onde é cor do time, preto no resto). |

### Escala de referência (tamanho final, 1×)

- 1 tile = losango de **64 × 32 px**.
- Pessoa adulta: **~32–36 px** de altura.
- Cavaleiro: **~42–44 px** de altura.
- Árvore: **~60–70 px** de altura.
- Casa (2×2 tiles): **~90–110 px** de altura total.

---

## 2. Direção visual sugerida

Pintura digital **semi-realista**, no espírito dos RTS 2D clássicos, com identidade própria:

- **Paleta natural e um pouco dessaturada:** verdes de oliva, terras quentes, pedra acinzentada, telhados de barro e palha. As cores fortes ficam reservadas às cores dos jogadores.
- **Contorno escuro sutil** (1 px a 1×) em unidades e objetos, para destacar do terreno.
- **Materiais medievais genéricos:** enxaimel, pedra rústica, palha, madeira. Evite elementos que lembrem marcas, civilizações ou edifícios de jogos existentes.

Se preferir outro estilo (por exemplo, mais cartunesco), basta que **todas** as imagens usem o mesmo. Consistência importa mais do que o estilo escolhido.

---

## 3. Assets já definidos

Os tamanhos estão em **1×**; entregue em 2×. O **ponto de apoio** é o pixel que fica exatamente sobre o centro do tile, ou o centro da base no caso de edifícios. É medido a partir do canto superior esquerdo da imagem 1×.

### Terrenos (9 tipos × 4 variações)

Grama, floresta (chão sob as árvores), terra, areia, rochas, montanha, água, vau e estrada.

- **Entrega recomendada:** textura **quadrada e contínua** (sem emendas), 256 × 256 px, vista de cima, sem objetos grandes. Um script converte em losangos 64 × 32. As 4 variações devem ter o mesmo tom médio.
- A água pode ter ondulações leves. A montanha deve parecer intransitável (rocha escura e irregular).

### Recursos naturais

| Asset | Nome no jogo | Tamanho | Ponto de apoio | Observações |
| --- | --- | --- | --- | --- |
| Árvore folhosa A | `res_tree_0` | 48 × 72 | (24, 66) | Copa redonda e densa |
| Árvore folhosa B | `res_tree_1` | 48 × 72 | (24, 66) | Variação de forma e tom |
| Conífera | `res_tree_2` | 48 × 72 | (24, 66) | Pinheiro |
| Árvore cortada | `res_tree_felled` | 48 × 72 | (24, 66) | Toco + tronco caído (mostrado depois do primeiro corte) |
| Mina de ouro | `res_goldMine_0` | 56 × 44 | (28, 34) | Rochas com pepitas/veios dourados bem visíveis |
| Mina de pedra | `res_stoneMine_0` | 56 × 44 | (28, 34) | Blocos de pedra clara |
| Arbusto frutífero | `res_berryBush_0` | 40 × 34 | (20, 26) | Frutos vermelhos visíveis de longe |

### Ícones de carga (sobre o aldeão)

| Asset | Nome no jogo | Tamanho |
| --- | --- | --- |
| Madeira | `carry_wood` | 12 × 10 |
| Comida | `carry_food` | 12 × 10 |
| Ouro | `carry_gold` | 12 × 10 |
| Pedra | `carry_stone` | 12 × 10 |

### Edifícios

| Asset | Área | Tamanho da imagem | Ponto de apoio |
| --- | --- | --- | --- |
| Centro da Vila (`building_townCenter_<jogador>`) | 4×4 tiles | 264 × 240 | (132, 172) |
| Casa (`building_house_<jogador>`) | 2×2 tiles | 136 × 130 | (68, 94) |
| Depósito de Madeira (`building_lumberCamp_<jogador>`) | 2×2 tiles | 136 × 115 | (68, 79) |
| Depósito de Mineração (`building_miningCamp_<jogador>`) | 2×2 tiles | 136 × 115 | (68, 79) |
| Quartel (`building_barracks_<jogador>`) | 3×3 tiles | 200 × 180 | (100, 128) |
| Campo de Arqueiros (`building_archeryRange_<jogador>`) | 3×3 tiles | 200 × 150 | (100, 98) |

Regra geral: a base do edifício preenche o losango da área ocupada, com largura (L + A)·32 px e altura (L + A)·16 px para uma área de L×A tiles. A imagem tem essa largura + 8 px, e o ponto de apoio fica no centro do losango, 4 px acima da borda inferior da base.

- **Casa:** pequena, enxaimel e telhado de palha.
- **Depósito de madeira:** galpão de tábuas com pilha de toras visível.
- **Depósito de mineração:** construção de pedra com carrinho de minério (ouro e pedra).
- **Quartel:** base de pedra, andar de madeira, escudos e lanças.
- **Campo de Arqueiros:** terreno cercado com alvos de treino e um galpão.

### Efeitos

| Asset | Nome no jogo | Tamanho |
| --- | --- | --- |
| Flecha (apontando para a direita) | `projectile_arrow` | 14 × 4 |
| Escombros (2×2, 3×3, 4×4 tiles) | `rubble_2`, `rubble_3`, `rubble_4` | (n·64 + 8) × (n·32 + 20) |

Para obras em andamento, o jogo recorta a imagem do edifício de baixo para cima; não é necessário fornecer etapas de construção separadas (opcional no futuro).

### Unidades (provisório)

Aldeão (26 × 38, apoio nos pés em (13, 35)), batedor (48 × 44, apoio em (24, 41)) e soldados — espadachim, lanceiro, arqueiro (30 × 40, apoio em (15, 37)). **Ainda não produza as versões definitivas:** elas precisarão de 8 direções e várias animações, especificadas depois da Fase 4. Para unidades, o caminho recomendado é modelo 3D + renderização com câmera isométrica fixa (ver a seção 5).

---

## 4. Modelos de prompt

Modelos de imagem costumam responder melhor em inglês. Ajuste o trecho entre colchetes.

**Objeto ou recurso:**

```text
Isometric 2:1 game sprite of [a medieval oak tree], semi-realistic digital painting,
classic 2D real-time strategy game style, viewed from above at 30 degrees,
light from the top-left, soft elliptical contact shadow,
transparent background, centered, no ground tile, no text, crisp silhouette
```

**Edifício:**

```text
Isometric 2:1 game sprite of [a medieval timber-framed town hall with a clay-tile roof],
footprint fills a diamond base, semi-realistic digital painting, classic 2D RTS style,
light from the top-left, neutral gray banners (for team color),
transparent background, no ground, no text, original design
```

**Textura de terreno:**

```text
Seamless tileable top-down texture of [short green grass with small flowers],
natural muted colors, even lighting, no large objects, 256x256, game texture
```

Dica: gere várias opções, escolha **uma imagem de referência** de estilo e use-a como referência visual (*image prompt* / *style reference*) para todas as próximas imagens.

---

## 5. Unidades animadas (planejamento)

Gerar quadros de animação diretamente com IA de imagem costuma dar personagens inconsistentes entre quadros e direções. O fluxo recomendado:

1. Modelo 3D do personagem: gerado por IA de texto/imagem para 3D, comprado ou modelado.
2. Animações (andar, coletar, atacar, morrer) aplicadas no Blender.
3. Script do Blender com câmera ortográfica isométrica fixa, mesma luz deste guia, renderizando **8 direções** por animação, com fundo transparente.
4. Máscara de cor do jogador renderizada em uma passada separada.

---

## 6. Checklist antes de entregar uma arte

- [ ] PNG com fundo transparente, sem bordas brancas ou halos.
- [ ] Ângulo conferido sobre um losango 2:1 (a base encaixa no losango dos tiles).
- [ ] Luz vindo do alto à esquerda.
- [ ] Tamanho em 2× e ponto de apoio anotado.
- [ ] Legível em tamanho pequeno (reduza para 1× e confira).
- [ ] Áreas de cor do jogador em cinza neutro + máscara (edifícios e unidades).
- [ ] Ferramenta, prompt e termos de licença registrados (uso comercial permitido).

## 7. Registro de licenças

Mantenha um arquivo `assets/CREDITS.md` com, para cada arte: arquivo, ferramenta ou autor, data, prompt (se IA), licença e link dos termos de uso.
