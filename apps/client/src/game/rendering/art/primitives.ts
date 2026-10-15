/** Primitivas de desenho em canvas para a arte procedural. */
export type Ctx = CanvasRenderingContext2D;
export type Point = readonly [number, number];

export function diamond(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
}

export function poly(ctx: Ctx, points: readonly Point[]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function shadow(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Caixa isométrica: (cx, cy) é o centro da base; desenha as duas faces frontais e o topo. */
export function isoBox(ctx: Ctx, cx: number, cy: number, hw: number, hh: number, h: number, top: string, left: string, right: string): void {
  ctx.fillStyle = left;
  poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx, cy + hh - h], [cx - hw, cy - h]]);
  ctx.fillStyle = right;
  poly(ctx, [[cx, cy + hh], [cx + hw, cy], [cx + hw, cy - h], [cx, cy + hh - h]]);
  ctx.fillStyle = top;
  poly(ctx, [[cx, cy - hh - h], [cx + hw, cy - h], [cx, cy + hh - h], [cx - hw, cy - h]]);
}

/** Telhado piramidal: desenha só as duas faces frontais (as de trás ficam ocultas). */
export function pyramidRoof(ctx: Ctx, cx: number, baseY: number, hw: number, hh: number, height: number, left: string, right: string): Point {
  const apex: Point = [cx, baseY - height];
  ctx.fillStyle = left;
  poly(ctx, [[cx - hw, baseY], [cx, baseY + hh], apex]);
  ctx.fillStyle = right;
  poly(ctx, [[cx, baseY + hh], [cx + hw, baseY], apex]);
  return apex;
}

/** Mastro com bandeira na cor do jogador. */
export function flag(ctx: Ctx, x: number, y: number, poleHeight: number, color: string, shadeColor: string): void {
  ctx.strokeStyle = '#4a3420';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - poleHeight);
  ctx.stroke();
  const top = y - poleHeight;
  ctx.fillStyle = color;
  poly(ctx, [[x, top], [x + poleHeight * 0.7, top + poleHeight * 0.18], [x, top + poleHeight * 0.4]]);
  ctx.fillStyle = shadeColor;
  poly(ctx, [[x, top + poleHeight * 0.2], [x + poleHeight * 0.7, top + poleHeight * 0.18], [x, top + poleHeight * 0.4]]);
}
