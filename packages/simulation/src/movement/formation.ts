import type { Vec2 } from '@eoc/shared';
import type { NavGrid } from '../pathfinding/NavGrid';
import { hasLineOfSight } from '../pathfinding/smoothing';

export interface FormationMember {
  x: number;
  y: number;
  radius: number;
}

const MAX_RING = 24;

/**
 * Distribui destinos para um grupo de unidades em torno do ponto alvo, em anéis
 * de uma malha regular, evitando que todas disputem o mesmo ponto.
 * Retorna um destino por membro, na mesma ordem de `members`.
 */
export function distributeDestinations(grid: NavGrid, target: Vec2, members: readonly FormationMember[]): Vec2[] {
  if (members.length === 0) return [];
  const first = members[0]!;
  const component = grid.componentAt(Math.floor(first.x), Math.floor(first.y));

  let center: Vec2 = { x: target.x, y: target.y };
  const tx = Math.floor(target.x);
  const ty = Math.floor(target.y);
  if (!grid.isWalkable(tx, ty) || (component >= 0 && grid.componentAt(tx, ty) !== component)) {
    const near = grid.findNearestWalkable(tx, ty, component >= 0 ? component : null, Math.max(grid.width, grid.height));
    if (near) center = { x: near.x + 0.5, y: near.y + 0.5 };
  }
  if (members.length === 1) return [center];

  let maxRadius = 0;
  for (const m of members) maxRadius = Math.max(maxRadius, m.radius);
  const spacing = Math.max(0.6, maxRadius * 2 + 0.2);

  const slots: Vec2[] = [];
  for (let ring = 0; ring <= MAX_RING && slots.length < members.length; ring++) {
    const ringSlots: Vec2[] = [];
    for (let j = -ring; j <= ring; j++) {
      for (let i = -ring; i <= ring; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const p = { x: center.x + i * spacing, y: center.y + j * spacing };
        const px = Math.floor(p.x);
        const py = Math.floor(p.y);
        if (!grid.isWalkable(px, py)) continue;
        if (component >= 0 && grid.componentAt(px, py) !== component) continue;
        if (!hasLineOfSight(grid, center.x, center.y, p.x, p.y, 0)) continue;
        ringSlots.push(p);
      }
    }
    ringSlots.sort((a, b) => dist2(a, center) - dist2(b, center));
    slots.push(...ringSlots);
  }
  while (slots.length < members.length) slots.push(center);
  slots.length = members.length;

  // Atribuição gulosa: cada vaga (da mais central para a mais externa) recebe a unidade livre mais próxima.
  const result: Vec2[] = new Array(members.length);
  const taken = new Uint8Array(members.length);
  for (const slot of slots) {
    let best = -1;
    let bestDist = Infinity;
    for (let k = 0; k < members.length; k++) {
      if (taken[k]) continue;
      const d = dist2(members[k]!, slot);
      if (d < bestDist) {
        bestDist = d;
        best = k;
      }
    }
    taken[best] = 1;
    result[best] = slot;
  }
  return result;
}

function dist2(a: Vec2, b: Vec2): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
