import { getBuildingDefinition } from '@eoc/game-data';
import { shade, toCssColor } from '../color';
import { circle, flag, isoBox, poly, pyramidRoof, type Ctx, type Point } from './primitives';

/**
 * Dimensões da arte de um edifício. A base ocupa o losango da área em tiles:
 * largura (w + h)·32 px e altura (w + h)·16 px; (baseX, baseY) é o centro desse losango.
 */
export interface BuildingArt {
  width: number;
  height: number;
  baseX: number;
  baseY: number;
  /** Meia-largura e meia-altura do losango da base. */
  hw: number;
  hh: number;
}

/** Altura total da imagem por tipo (o resto é derivado da área ocupada). */
const ART_HEIGHT: Record<string, number> = { townCenter: 240, house: 130, lumberCamp: 115, miningCamp: 115, barracks: 180 };

export function buildingArt(type: string): BuildingArt {
  const { w, h } = getBuildingDefinition(type).footprint;
  const hw = (w + h) * 16;
  const hh = (w + h) * 8;
  const width = hw * 2 + 8;
  const height = ART_HEIGHT[type] ?? hh * 2 + 120;
  return { width, height, baseX: width / 2, baseY: height - hh - 4, hw, hh };
}

export function drawBuilding(ctx: Ctx, type: string, playerColor: number): void {
  const art = buildingArt(type);
  const { baseX: cx, baseY: cy } = art;
  switch (type) {
    case 'townCenter':
      return drawTownCenter(ctx, playerColor, cx, cy);
    case 'house':
      return drawHouse(ctx, playerColor, art);
    case 'lumberCamp':
      return drawLumberCamp(ctx, playerColor, art);
    case 'miningCamp':
      return drawMiningCamp(ctx, playerColor, art);
    case 'barracks':
      return drawBarracks(ctx, playerColor, art);
    default:
      // Edifício sem arte própria: bloco neutro com bandeira (nunca deixa o jogo sem imagem).
      isoBox(ctx, cx, cy, art.hw * 0.8, art.hh * 0.8, 40, '#b8ad98', '#a39883', '#857b68');
      flag(ctx, cx, cy - 40, 24, toCssColor(playerColor), shade(playerColor, -0.3));
  }
}

/** Faixas de enxaimel nas duas faces frontais de uma caixa isométrica. */
function timber(ctx: Ctx, cx: number, baseY: number, hw: number, hh: number, h: number, beams: number): void {
  ctx.strokeStyle = '#5a3d22';
  ctx.lineWidth = 2;
  for (let i = 0; i <= beams; i++) {
    const t = i / beams;
    ctx.beginPath();
    ctx.moveTo(cx - hw + hw * t, baseY + hh * t);
    ctx.lineTo(cx - hw + hw * t, baseY + hh * t - h);
    ctx.moveTo(cx + hw * t, baseY + hh - hh * t);
    ctx.lineTo(cx + hw * t, baseY + hh - hh * t - h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - hw, baseY - h / 2);
  ctx.lineTo(cx, baseY + hh - h / 2);
  ctx.lineTo(cx + hw, baseY - h / 2);
  ctx.stroke();
}

/** Porta na face direita, a uma fração `t` da largura. */
function door(ctx: Ctx, cx: number, baseY: number, hw: number, hh: number, t: number, width: number, height: number): void {
  const x0 = cx + hw * t;
  const y0 = baseY + hh - hh * t;
  const dx = width;
  const dy = (width * hh) / hw;
  ctx.fillStyle = '#3d2814';
  poly(ctx, [[x0, y0], [x0 + dx, y0 - dy], [x0 + dx, y0 - dy - height], [x0, y0 - height]]);
}

function drawHouse(ctx: Ctx, playerColor: number, a: BuildingArt): void {
  const { baseX: cx, baseY: cy, hw, hh } = a;
  isoBox(ctx, cx, cy, hw - 4, hh - 2, 4, '#8f8a7e', '#7d776b', '#666054');
  const wh = 28;
  const by = cy - 4;
  isoBox(ctx, cx, by, hw * 0.68, hh * 0.68, wh, '#e0cfa8', '#dccaa2', '#bba883');
  timber(ctx, cx, by, hw * 0.68, hh * 0.68, wh, 3);
  door(ctx, cx, by, hw * 0.68, hh * 0.68, 0.4, 11, 18);
  const apex = pyramidRoof(ctx, cx, by - wh, hw * 0.78, hh * 0.78, 42, '#b8923f', '#94732c');
  ctx.strokeStyle = 'rgba(70,50,15,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.78 * (1 - t), by - wh - 42 * t);
    ctx.lineTo(cx, by - wh + hh * 0.78 * (1 - t) - 42 * t);
    ctx.lineTo(cx + hw * 0.78 * (1 - t), by - wh - 42 * t);
    ctx.stroke();
  }
  flag(ctx, apex[0], apex[1], 20, toCssColor(playerColor), shade(playerColor, -0.3));
}

function drawLumberCamp(ctx: Ctx, playerColor: number, a: BuildingArt): void {
  const { baseX: cx, baseY: cy, hw, hh } = a;
  isoBox(ctx, cx, cy, hw - 4, hh - 2, 3, '#8a6a43', '#76593a', '#5f472d');
  const by = cy - 3;
  // Galpão aberto: paredes baixas de tábuas e telhado escuro.
  isoBox(ctx, cx + 8, by - 4, hw * 0.55, hh * 0.55, 22, '#8a6238', '#7a5530', '#5e4024');
  ctx.strokeStyle = 'rgba(30,18,8,0.5)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = by - 4 - (22 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + 8 - hw * 0.55, y);
    ctx.lineTo(cx + 8, y + hh * 0.55);
    ctx.lineTo(cx + 8 + hw * 0.55, y);
    ctx.stroke();
  }
  const apex = pyramidRoof(ctx, cx + 8, by - 26, hw * 0.65, hh * 0.65, 24, '#5b4030', '#43301f');
  // Pilha de toras na frente à esquerda.
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const x = cx - hw * 0.45 + i * 9 + row * 4.5;
      const y = cy + 6 - row * 7;
      ctx.fillStyle = '#6e4a2a';
      poly(ctx, [[x - 14, y - 7], [x, y], [x, y - 7], [x - 14, y - 14]]);
      circle(ctx, x, y - 3.5, 3.6, '#d6b07a');
      circle(ctx, x, y - 3.5, 1.4, '#9a7448');
    }
  }
  flag(ctx, apex[0], apex[1], 22, toCssColor(playerColor), shade(playerColor, -0.3));
}

function drawMiningCamp(ctx: Ctx, playerColor: number, a: BuildingArt): void {
  const { baseX: cx, baseY: cy, hw, hh } = a;
  isoBox(ctx, cx, cy, hw - 4, hh - 2, 3, '#8d887c', '#7a756a', '#625e55');
  const by = cy - 3;
  isoBox(ctx, cx + 8, by - 4, hw * 0.55, hh * 0.55, 24, '#a39d90', '#958f83', '#77726a');
  // Blocos de pedra nas paredes.
  ctx.strokeStyle = 'rgba(40,38,34,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = by - 4 - (24 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + 8 - hw * 0.55, y);
    ctx.lineTo(cx + 8, y + hh * 0.55);
    ctx.lineTo(cx + 8 + hw * 0.55, y);
    ctx.stroke();
  }
  door(ctx, cx + 8, by - 4, hw * 0.55, hh * 0.55, 0.35, 9, 14);
  const apex = pyramidRoof(ctx, cx + 8, by - 28, hw * 0.65, hh * 0.65, 22, '#5d636b', '#474c53');
  // Carrinho com minério.
  const x = cx - hw * 0.42;
  const y = cy + 4;
  ctx.fillStyle = '#5a3d22';
  poly(ctx, [[x - 14, y - 10], [x + 4, y - 1], [x + 4, y - 10], [x - 14, y - 19]]);
  ctx.fillStyle = '#6e4a2a';
  poly(ctx, [[x + 4, y - 1], [x + 14, y - 6], [x + 14, y - 15], [x + 4, y - 10]]);
  for (const [ox, oy, c] of [
    [-6, -16, '#f2c94c'],
    [0, -15, '#b8b2a6'],
    [5, -17, '#f2c94c'],
    [-2, -19, '#b8b2a6'],
  ] as const) {
    circle(ctx, x + ox, y + oy, 3, c);
  }
  circle(ctx, x - 9, y - 6, 3, '#2b1d10');
  circle(ctx, x + 9, y - 2, 3, '#2b1d10');
  flag(ctx, apex[0], apex[1], 22, toCssColor(playerColor), shade(playerColor, -0.3));
}

function drawBarracks(ctx: Ctx, playerColor: number, a: BuildingArt): void {
  const { baseX: cx, baseY: cy, hw, hh } = a;
  const color = toCssColor(playerColor);
  isoBox(ctx, cx, cy, hw - 4, hh - 2, 6, '#8f8a7e', '#7d776b', '#666054');
  const by = cy - 6;
  const wh = 44;
  // Base de pedra e parte superior de madeira.
  isoBox(ctx, cx, by, hw * 0.74, hh * 0.74, wh, '#a39d90', '#9a9487', '#7b766b');
  isoBox(ctx, cx, by - wh * 0.45, hw * 0.74, hh * 0.74, wh * 0.55, '#c9b38a', '#c4ad82', '#a08a63');
  timber(ctx, cx, by - wh * 0.45, hw * 0.74, hh * 0.74, wh * 0.55, 4);
  door(ctx, cx, by, hw * 0.74, hh * 0.74, 0.38, 18, 26);
  // Escudos com a cor do jogador na face esquerda.
  for (const t of [0.3, 0.7]) {
    const x = cx - hw * 0.74 + hw * 0.74 * t;
    const y = by + hh * 0.74 * t - wh * 0.7;
    ctx.fillStyle = '#3a2a1a';
    poly(ctx, [[x - 6, y - 7], [x + 6, y - 4], [x + 6, y + 4], [x, y + 9], [x - 6, y + 2]]);
    ctx.fillStyle = color;
    poly(ctx, [[x - 4.5, y - 5], [x + 4.5, y - 2.8], [x + 4.5, y + 3.2], [x, y + 7], [x - 4.5, y + 1.6]]);
  }
  const roofBase = by - wh;
  const apex = pyramidRoof(ctx, cx, roofBase, hw * 0.84, hh * 0.84, 48, '#7d3b2a', '#5e2a1e');
  // Lanças encostadas na parede (frente à esquerda).
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const x = cx - hw * 0.62 + i * 7;
    const y = cy + hh * 0.05 + i * 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 6, y - 36);
    ctx.stroke();
    ctx.fillStyle = '#9aa0a6';
    poly(ctx, [[x + 4, y - 36], [x + 6, y - 44], [x + 8, y - 36]] as Point[]);
  }
  flag(ctx, apex[0], apex[1], 30, color, shade(playerColor, -0.3));
}

function drawTownCenter(ctx: Ctx, playerColor: number, cx: number, cy: number): void {
  const color = toCssColor(playerColor);
  // Plataforma de pedra cobrindo a área 4×4
  isoBox(ctx, cx, cy, 124, 62, 8, '#9b958a', '#857f74', '#6c665c');
  // Paredes
  const wallH = 54;
  isoBox(ctx, cx, cy - 8, 88, 44, wallH, '#d9c7a0', '#d6c29a', '#b6a27c');
  // Vigas de madeira nas paredes
  ctx.strokeStyle = '#5a3d22';
  ctx.lineWidth = 3;
  const baseY = cy - 8;
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const lx = cx - 88 + 88 * t;
    const ly = baseY + 44 * t;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly - wallH);
    ctx.stroke();
    const rx = cx + 88 * t;
    const ry = baseY + 44 - 44 * t;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx, ry - wallH);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 88, baseY - wallH / 2);
  ctx.lineTo(cx, baseY + 44 - wallH / 2);
  ctx.lineTo(cx + 88, baseY - wallH / 2);
  ctx.stroke();
  // Porta (face direita)
  ctx.fillStyle = '#3d2814';
  poly(ctx, [[cx + 30, baseY + 29], [cx + 50, baseY + 19], [cx + 50, baseY - 9], [cx + 30, baseY + 1]]);
  // Janelas (face esquerda)
  ctx.fillStyle = '#2b1d10';
  for (const t of [0.3, 0.7]) {
    const x = cx - 88 + 88 * t;
    const y = baseY + 44 * t - 36;
    poly(ctx, [[x - 6, y - 3], [x + 6, y + 3], [x + 6, y + 13], [x - 6, y + 7]]);
  }
  // Telhado piramidal
  const roofBase = baseY - wallH;
  const apex: Point = [cx, roofBase - 78];
  ctx.fillStyle = '#7d3b2a';
  poly(ctx, [[cx - 98, roofBase], [cx, roofBase + 49], apex]);
  ctx.fillStyle = '#5e2a1e';
  poly(ctx, [[cx, roofBase + 49], [cx + 98, roofBase], apex]);
  // Telhas: linhas paralelas à base em cada face visível
  ctx.strokeStyle = 'rgba(40,15,10,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    const lerp = (a: Point, b: Point): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const l = lerp([cx - 98, roofBase], apex);
    const b = lerp([cx, roofBase + 49], apex);
    const r = lerp([cx + 98, roofBase], apex);
    ctx.beginPath();
    ctx.moveTo(l[0], l[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(r[0], r[1]);
    ctx.stroke();
  }
  // Mastro e bandeira do jogador
  ctx.strokeStyle = '#4a3420';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(apex[0], apex[1] - 34);
  ctx.stroke();
  ctx.fillStyle = color;
  poly(ctx, [[apex[0], apex[1] - 34], [apex[0] + 24, apex[1] - 28], [apex[0], apex[1] - 20]]);
  ctx.fillStyle = shade(playerColor, -0.3);
  poly(ctx, [[apex[0], apex[1] - 27], [apex[0] + 24, apex[1] - 28], [apex[0], apex[1] - 20]]);
  // Estandartes laterais
  for (const [x, y] of [
    [cx - 60, baseY + 10],
    [cx + 60, baseY + 10],
  ] as const) {
    ctx.fillStyle = color;
    ctx.fillRect(x - 5, y - 40, 10, 18);
    ctx.fillStyle = '#e0b44c';
    ctx.fillRect(x - 5, y - 40, 10, 2);
  }
}
