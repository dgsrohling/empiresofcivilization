import { shade, toCssColor } from '../color';
import { circle, poly, shadow, type Ctx } from './primitives';

/** Unidades militares: 30 × 40 px, ponto de apoio nos pés em (15, 37). */
export const SOLDIER_SIZE = { w: 30, h: 40, footX: 15, footY: 37 } as const;

function body(ctx: Ctx, tunic: string, tunicShade: string, legs: string): void {
  shadow(ctx, 15, 37, 9, 3);
  ctx.fillStyle = legs;
  ctx.fillRect(11, 28, 3, 9);
  ctx.fillRect(16, 28, 3, 9);
  ctx.fillStyle = tunic;
  poly(ctx, [[9, 29], [10, 16], [20, 16], [21, 29]]);
  ctx.fillStyle = tunicShade;
  poly(ctx, [[15, 16], [20, 16], [21, 29], [15, 29]]);
  circle(ctx, 15, 11, 5, '#e8be96');
}

export function drawSwordsman(ctx: Ctx, playerColor: number): void {
  const color = toCssColor(playerColor);
  body(ctx, '#8c939a', '#6b7178', '#3a2a1c');
  // Sobreveste com a cor do jogador
  ctx.fillStyle = color;
  poly(ctx, [[12, 18], [18, 18], [19, 29], [11, 29]]);
  ctx.fillStyle = '#d9ad4c';
  ctx.fillRect(11, 23, 8, 1.5);
  // Elmo
  ctx.fillStyle = '#9aa0a6';
  poly(ctx, [[9.5, 11], [15, 4], [20.5, 11], [20.5, 13], [9.5, 13]]);
  ctx.fillStyle = '#3a3f44';
  ctx.fillRect(12, 11.5, 6, 1.2);
  // Escudo (esquerda) e espada (direita)
  ctx.fillStyle = '#3a2a1a';
  poly(ctx, [[3, 17], [10, 16], [10, 26], [6.5, 30], [3, 26]]);
  ctx.fillStyle = color;
  poly(ctx, [[4, 18], [9, 17.3], [9, 25.5], [6.5, 28.5], [4, 25.5]]);
  ctx.fillStyle = '#e0b44c';
  ctx.fillRect(6, 19, 1.5, 7);
  ctx.strokeStyle = '#d6dbe0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 24);
  ctx.lineTo(28, 10);
  ctx.stroke();
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(20.5, 23, 4, 2);
}

export function drawSpearman(ctx: Ctx, playerColor: number): void {
  const color = toCssColor(playerColor);
  body(ctx, color, shade(playerColor, -0.3), '#4a3420');
  ctx.fillStyle = '#7a5530';
  ctx.fillRect(10, 22, 10, 2);
  // Capacete simples
  ctx.fillStyle = '#7c8288';
  ctx.beginPath();
  ctx.arc(15, 9.5, 5.5, Math.PI, 0);
  ctx.fill();
  // Lança longa
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(20, 34);
  ctx.lineTo(27, 1.5);
  ctx.stroke();
  ctx.fillStyle = '#c9ced3';
  poly(ctx, [[25.6, 4], [27.8, -1], [29, 4.6]]);
  ctx.fillStyle = '#e0b48c';
  ctx.fillRect(19, 19, 3, 3);
}

export function drawArcher(ctx: Ctx, playerColor: number): void {
  const color = toCssColor(playerColor);
  body(ctx, color, shade(playerColor, -0.3), '#3d3a2a');
  // Capuz
  ctx.fillStyle = '#4f5a35';
  poly(ctx, [[9, 13], [15, 3.5], [21, 13], [19, 15], [11, 15]]);
  circle(ctx, 15, 11.5, 3.2, '#e8be96');
  // Aljava nas costas
  ctx.fillStyle = '#6b4a2a';
  poly(ctx, [[8, 16], [11, 15], [12, 26], [9, 27]]);
  ctx.strokeStyle = '#d6d0c0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, 15);
  ctx.lineTo(8, 12);
  ctx.moveTo(10.5, 15);
  ctx.lineTo(10, 11.5);
  ctx.stroke();
  // Arco
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(19, 21, 9, -Math.PI / 2.4, Math.PI / 2.4);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(240,235,220,0.8)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(19 + 9 * Math.cos(-Math.PI / 2.4), 21 + 9 * Math.sin(-Math.PI / 2.4));
  ctx.lineTo(19 + 9 * Math.cos(Math.PI / 2.4), 21 + 9 * Math.sin(Math.PI / 2.4));
  ctx.stroke();
}

/** Flecha horizontal (apontando para a direita), 14 × 4 px. */
export function drawArrow(ctx: Ctx): void {
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(1, 2);
  ctx.lineTo(11, 2);
  ctx.stroke();
  ctx.fillStyle = '#c9ced3';
  poly(ctx, [[10, 0.5], [14, 2], [10, 3.5]]);
  ctx.fillStyle = '#e6e0d0';
  poly(ctx, [[0, 0.5], [3, 2], [0, 3.5]]);
}

/** Escombros de edifício destruído sobre um losango de `n × n` tiles. */
export function drawRubble(ctx: Ctx, n: number, seed: number): void {
  const hw = n * 32;
  const hh = n * 16;
  const cx = hw + 4;
  const cy = hh + 10;
  ctx.fillStyle = 'rgba(70,52,34,0.75)';
  poly(ctx, [[cx, cy - hh * 0.85], [cx + hw * 0.85, cy], [cx, cy + hh * 0.85], [cx - hw * 0.85, cy]]);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n * 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 0.75;
    const x = cx + Math.cos(a) * hw * r;
    const y = cy + Math.sin(a) * hh * r;
    if (rnd() < 0.5) {
      ctx.fillStyle = rnd() < 0.5 ? '#8f8a7e' : '#6c665c';
      poly(ctx, [[x - 4, y], [x, y - 3], [x + 5, y - 1], [x + 2, y + 2.5]]);
    } else {
      ctx.strokeStyle = rnd() < 0.5 ? '#5a3d22' : '#3d2814';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 1);
      ctx.lineTo(x + 5, y - 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = 'rgba(30,25,20,0.35)';
  for (let i = 0; i < n * 3; i++) circle(ctx, cx + (rnd() - 0.5) * hw, cy + (rnd() - 0.5) * hh, 3 + rnd() * 4, 'rgba(30,25,20,0.35)');
}
