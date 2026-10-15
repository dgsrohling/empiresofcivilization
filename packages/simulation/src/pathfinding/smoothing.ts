import type { Vec2 } from '@eoc/shared';
import type { NavGrid } from './NavGrid';

const SAMPLE_STEP = 0.1;

/**
 * Linha de visão para navegação: amostra o segmento e verifica o centro e as
 * bordas laterais (± raio) da unidade, evitando que o atalho raspe em obstáculos.
 */
export function hasLineOfSight(grid: NavGrid, ax: number, ay: number, bx: number, by: number, radius: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return grid.isWalkableAt(ax, ay);
  const steps = Math.ceil(length / SAMPLE_STEP);
  const nx = (-dy / length) * radius;
  const ny = (dx / length) * radius;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = ax + dx * t;
    const py = ay + dy * t;
    if (!grid.isWalkableAt(px, py)) return false;
    if (radius > 0 && (!grid.isWalkableAt(px + nx, py + ny) || !grid.isWalkableAt(px - nx, py - ny))) return false;
  }
  return true;
}

/**
 * Suaviza um caminho de tiles removendo pontos intermediários desnecessários
 * ("string pulling" guloso). O primeiro ponto é a posição atual da unidade.
 */
export function smoothPath(grid: NavGrid, points: Vec2[], radius: number): Vec2[] {
  if (points.length <= 2) return points.slice();
  const result: Vec2[] = [points[0] as Vec2];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = anchor + 1;
    const a = points[anchor] as Vec2;
    while (next + 1 < points.length) {
      const candidate = points[next + 1] as Vec2;
      if (!hasLineOfSight(grid, a.x, a.y, candidate.x, candidate.y, radius)) break;
      next++;
    }
    result.push(points[next] as Vec2);
    anchor = next;
  }
  return result;
}
