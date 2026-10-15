import { getBuildingDefinition, getUnitDefinition, type GathererStats, type ResourceNodeType } from '@eoc/game-data';
import type { PlayerId, ResourceType, Vec2 } from '@eoc/shared';
import type { World } from '../core/World';
import type { BuildingEntity, ResourceEntity, UnitEntity } from '../entities/types';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectOf(e: BuildingEntity | ResourceEntity): TileRect {
  return e.kind === 'building' ? { x: e.tileX, y: e.tileY, w: e.width, h: e.height } : { x: e.tileX, y: e.tileY, w: 1, h: 1 };
}

/** Distância euclidiana de um ponto à borda de um retângulo de tiles (0 se dentro). */
export function distanceToRect(px: number, py: number, r: TileRect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

export function gathererStats(unit: UnitEntity): GathererStats | undefined {
  return getUnitDefinition(unit.type).gatherer;
}

export function unitComponent(world: World, unit: UnitEntity): number {
  return world.grid.componentAt(Math.floor(unit.x), Math.floor(unit.y));
}

/** Tiles transitáveis em volta do retângulo (anel externo, inclusive diagonais), no componente informado. */
function forEachApproachTile(world: World, r: TileRect, component: number, fn: (tx: number, ty: number) => void): void {
  const grid = world.grid;
  for (let y = r.y - 1; y <= r.y + r.h; y++) {
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      const border = x === r.x - 1 || x === r.x + r.w || y === r.y - 1 || y === r.y + r.h;
      if (!border || !grid.isWalkable(x, y)) continue;
      if (component >= 0 && grid.componentAt(x, y) !== component) continue;
      fn(x, y);
    }
  }
}

export function isAccessible(world: World, r: TileRect, component: number): boolean {
  let found = false;
  forEachApproachTile(world, r, component, () => (found = true));
  return found;
}

/**
 * Escolhe o ponto de aproximação (centro de um tile vizinho) mais conveniente para a unidade:
 * perto dela e, de preferência, não ocupado/reservado por outras unidades.
 */
export function findApproachPoint(world: World, r: TileRect, unit: UnitEntity): Vec2 | null {
  const component = unitComponent(world, unit);
  const candidates: Array<{ x: number; y: number; key: number }> = [];
  forEachApproachTile(world, r, component, (x, y) => candidates.push({ x, y, key: y * world.width + x }));
  if (candidates.length === 0) return null;

  const crowd = new Map<number, number>();
  for (const c of candidates) crowd.set(c.key, 0);
  for (const other of world.units) {
    if (other === unit) continue;
    const p = other.moveGoal ?? other;
    const key = Math.floor(p.y) * world.width + Math.floor(p.x);
    const count = crowd.get(key);
    if (count !== undefined) crowd.set(key, count + 1);
  }

  let best: Vec2 | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    const cx = c.x + 0.5;
    const cy = c.y + 0.5;
    const score = Math.hypot(cx - unit.x, cy - unit.y) + (crowd.get(c.key) ?? 0) * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

/** Fonte de recurso mais próxima de (cx, cy) com o mesmo tipo, acessível a partir do componente. */
export function findNearestResource(
  world: World,
  nodeType: ResourceNodeType,
  cx: number,
  cy: number,
  radius: number,
  component: number,
  excludeId: number | null = null,
): ResourceEntity | null {
  let best: ResourceEntity | null = null;
  let bestDist = Infinity;
  const x0 = Math.floor(cx - radius);
  const x1 = Math.floor(cx + radius);
  const y0 = Math.floor(cy - radius);
  const y1 = Math.floor(cy + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const e = world.getStaticAtTile(x, y);
      if (!e || e.kind !== 'resource' || e.nodeType !== nodeType || e.amount <= 0 || e.id === excludeId) continue;
      const d = Math.hypot(e.x - cx, e.y - cy);
      if (d > radius || d > bestDist || (d === bestDist && best && e.id > best.id)) continue;
      if (!isAccessible(world, rectOf(e), component)) continue;
      best = e;
      bestDist = d;
    }
  }
  return best;
}

export function acceptsResource(building: BuildingEntity, resource: ResourceType): boolean {
  return building.complete && getBuildingDefinition(building.type).dropsiteFor.includes(resource);
}

/** Depósito concluído mais próximo do jogador que aceita o recurso. */
export function findNearestDropsite(world: World, owner: PlayerId, resource: ResourceType, x: number, y: number): BuildingEntity | null {
  let best: BuildingEntity | null = null;
  let bestDist = Infinity;
  for (const b of world.buildings) {
    if (b.owner !== owner || !acceptsResource(b, resource)) continue;
    const d = distanceToRect(x, y, rectOf(b));
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}
