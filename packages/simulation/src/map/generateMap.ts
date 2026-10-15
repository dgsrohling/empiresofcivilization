import { getTerrain, type ResourceNodeType } from '@eoc/game-data';
import { Terrain, type TerrainId, type Vec2 } from '@eoc/shared';
import { createValueNoise, fbm, normalizeInPlace } from '../core/noise';
import { Rng } from '../core/rng';
import { AStar, type CostGrid } from '../pathfinding/AStar';
import type { GeneratedMap, MapGenOptions, ResourceNodeSpec } from './types';
import { validateMap } from './validateMap';

const MAX_ATTEMPTS = 10;
/** Raio mínimo em torno do ponto de nascimento sem recursos (mantém o Centro da Vila acessível). */
const SPAWN_RESOURCE_FREE_RADIUS = 5.5;

/**
 * Gera um mapa de forma determinística a partir da seed.
 * Mapas que falham na validação são regerados com seeds derivadas; o resultado é sempre
 * o mesmo para a mesma combinação (seed, tamanho, jogadores).
 */
export function generateMap(options: MapGenOptions): GeneratedMap {
  if (options.size < 32) throw new Error('Tamanho mínimo do mapa: 32');
  if (options.playerCount < 1 || options.playerCount > 8) throw new Error('Quantidade de jogadores deve ser entre 1 e 8');
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptSeed = (options.seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    const map = generateAttempt(options, attemptSeed, attempt);
    const report = validateMap(map);
    if (report.valid) return map;
    lastIssues = report.issues;
  }
  throw new Error(`Falha ao gerar mapa válido: ${lastIssues.join('; ')}`);
}

class MapBuilder {
  readonly terrain: Uint8Array;
  readonly occupied: Uint8Array;
  readonly spawnDistance: Float32Array;
  readonly resources: ResourceNodeSpec[] = [];

  constructor(
    readonly size: number,
    readonly spawns: Vec2[],
  ) {
    const n = size * size;
    this.terrain = new Uint8Array(n);
    this.occupied = new Uint8Array(n);
    this.spawnDistance = new Float32Array(n);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let best = Infinity;
        for (const s of spawns) best = Math.min(best, Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y));
        this.spawnDistance[y * size + x] = best;
      }
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  /** Tile de terra firme, livre de recursos e fora de estradas/vaus/área inicial. */
  isFreeForResource(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const i = y * this.size + x;
    const t = this.terrain[i] as TerrainId;
    if (this.occupied[i] || t === Terrain.Road || t === Terrain.Shallows) return false;
    if (!getTerrain(t).walkable) return false;
    return (this.spawnDistance[i] as number) >= SPAWN_RESOURCE_FREE_RADIUS;
  }

  addResource(type: ResourceNodeType, x: number, y: number): void {
    this.occupied[y * this.size + x] = 1;
    this.resources.push({ type, x, y });
  }
}

function generateAttempt(options: MapGenOptions, seed: number, attempt: number): GeneratedMap {
  const { size, playerCount } = options;
  const rng = new Rng(seed);
  const spawns = placeSpawns(size, playerCount, rng);
  const b = new MapBuilder(size, spawns);

  shapeTerrain(b, rng);
  const withRiver = options.river ?? rng.chance(0.6);
  if (withRiver) carveRiver(b, rng);
  carveRoads(b);
  clearSpawnAreas(b);
  placeForests(b, rng);
  for (const spawn of spawns) placeStartingResources(b, rng, spawn);
  scatterResources(b, rng);

  return { seed: options.seed, attempt, width: size, height: size, terrain: b.terrain, spawns, resources: b.resources };
}

function placeSpawns(size: number, count: number, rng: Rng): Vec2[] {
  const spawns: Vec2[] = [];
  const center = size / 2;
  const radius = size * 0.33;
  const margin = 8;
  const angle0 = rng.range(0, Math.PI * 2);
  for (let i = 0; i < count; i++) {
    const a = angle0 + (i * Math.PI * 2) / count;
    const x = Math.round(center + Math.cos(a) * radius);
    const y = Math.round(center + Math.sin(a) * radius);
    spawns.push({ x: clamp(x, margin, size - margin), y: clamp(y, margin, size - margin) });
  }
  return spawns;
}

function shapeTerrain(b: MapBuilder, rng: Rng): void {
  const { size } = b;
  const n = size * size;
  const elevation = new Float32Array(n);
  const moisture = new Float32Array(n);
  const elevationNoise = createValueNoise(rng.int(1, 0x7fffffff));
  const moistureNoise = createValueNoise(rng.int(1, 0x7fffffff));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      elevation[i] = fbm(elevationNoise, x / 20, y / 20, 4);
      moisture[i] = fbm(moistureNoise, x / 12, y / 12, 3);
    }
  }
  normalizeInPlace(elevation);
  normalizeInPlace(moisture);

  for (let i = 0; i < n; i++) {
    const d = b.spawnDistance[i] as number;
    // Achata o relevo perto dos pontos de nascimento para garantir terreno jogável.
    const t = smoothstep(8, 16, d);
    const e = 0.5 + ((elevation[i] as number) - 0.5) * t;
    let m = moisture[i] as number;
    if (d < 9) m = Math.min(m, 0.45);
    b.terrain[i] = classify(e, m);
  }
}

function classify(e: number, m: number): TerrainId {
  if (e < 0.2) return Terrain.Water;
  if (e < 0.25) return Terrain.Sand;
  if (e > 0.86) return Terrain.Mountain;
  if (e > 0.76) return Terrain.Rock;
  if (m > 0.64) return Terrain.ForestFloor;
  if (m < 0.2) return Terrain.Dirt;
  return Terrain.Grass;
}

function carveRiver(b: MapBuilder, rng: Rng): void {
  const { size } = b;
  const vertical = rng.chance(0.5);
  const a = rng.range(0.3, 0.7) * size;
  const c = rng.range(0.3, 0.7) * size;
  const start = vertical ? { x: a, y: -2 } : { x: -2, y: a };
  const end = vertical ? { x: c, y: size + 2 } : { x: size + 2, y: c };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  const px = -dy / len;
  const py = dx / len;
  const meander = createValueNoise(rng.int(1, 0x7fffffff));
  const steps = size * 4;
  const radius = 1.3;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const offset = (fbm(meander, t * 5, 0.5, 3) - 0.5) * size * 0.45;
    const cx = start.x + dx * t + px * offset;
    const cy = start.y + dy * t + py * offset;
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
      for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
        if (!b.inBounds(x, y)) continue;
        const i = y * size + x;
        if ((b.spawnDistance[i] as number) < 11) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= radius) b.terrain[i] = Terrain.Water;
        else if (d <= radius + 1 && b.terrain[i] !== Terrain.Water && getTerrain(b.terrain[i] as number).walkable) b.terrain[i] = Terrain.Sand;
      }
    }
  }
}

const ROAD_COST: Record<TerrainId, number> = {
  [Terrain.Grass]: 1,
  [Terrain.ForestFloor]: 4,
  [Terrain.Dirt]: 1,
  [Terrain.Sand]: 1.5,
  [Terrain.Rock]: 2,
  [Terrain.Mountain]: 25,
  [Terrain.Water]: 10,
  [Terrain.Shallows]: 2,
  [Terrain.Road]: 0.3,
};

/** Liga os pontos de nascimento com estradas (4 direções), criando vaus sobre a água. Garante conectividade. */
function carveRoads(b: MapBuilder): void {
  const { size, spawns } = b;
  if (spawns.length < 2) return;
  const costs = new Float32Array(size * size);
  const grid: CostGrid = { width: size, height: size, costs, minCost: 0.3 };
  const astar = new AStar();
  const pairs = spawns.length === 2 ? [[0, 1]] : spawns.map((_, i) => [i, (i + 1) % spawns.length]);
  for (const [from, to] of pairs) {
    for (let i = 0; i < costs.length; i++) costs[i] = ROAD_COST[b.terrain[i] as TerrainId];
    const s = spawns[from!]!;
    const t = spawns[to!]!;
    const result = astar.findPath(grid, s.y * size + s.x, t.y * size + t.x, { allowDiagonal: false });
    for (const idx of result.path) {
      b.terrain[idx] = b.terrain[idx] === Terrain.Water ? Terrain.Shallows : Terrain.Road;
    }
  }
}

function clearSpawnAreas(b: MapBuilder): void {
  for (let i = 0; i < b.terrain.length; i++) {
    const d = b.spawnDistance[i] as number;
    const t = b.terrain[i] as TerrainId;
    if (d < 3.2) b.terrain[i] = Terrain.Grass;
    else if (d < 6.5 && t !== Terrain.Road && (!getTerrain(t).walkable || t === Terrain.Rock || t === Terrain.ForestFloor)) b.terrain[i] = Terrain.Grass;
  }
}

function placeForests(b: MapBuilder, rng: Rng): void {
  const { size } = b;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if ((b.spawnDistance[i] as number) < 7.5 || !b.isFreeForResource(x, y)) continue;
      const t = b.terrain[i];
      if ((t === Terrain.ForestFloor && rng.chance(0.8)) || (t === Terrain.Grass && rng.chance(0.012))) b.addResource('tree', x, y);
    }
  }
}

/** Cresce um aglomerado contíguo de recursos a partir de um tile âncora. */
function growCluster(b: MapBuilder, rng: Rng, ax: number, ay: number, type: ResourceNodeType, count: number): boolean {
  if (!b.isFreeForResource(ax, ay)) return false;
  const picked: Vec2[] = [];
  const seen = new Set<number>([ay * b.size + ax]);
  const frontier: Vec2[] = [{ x: ax, y: ay }];
  while (picked.length < count && frontier.length > 0) {
    const k = rng.int(0, frontier.length - 1);
    const tile = frontier[k]!;
    frontier[k] = frontier[frontier.length - 1]!;
    frontier.pop();
    if (!b.isFreeForResource(tile.x, tile.y)) continue;
    picked.push(tile);
    for (const [nx, ny] of [
      [tile.x + 1, tile.y],
      [tile.x - 1, tile.y],
      [tile.x, tile.y + 1],
      [tile.x, tile.y - 1],
    ] as const) {
      const key = ny * b.size + nx;
      if (b.inBounds(nx, ny) && !seen.has(key)) {
        seen.add(key);
        frontier.push({ x: nx, y: ny });
      }
    }
  }
  if (picked.length < count) return false;
  for (const p of picked) b.addResource(type, p.x, p.y);
  return true;
}

function placeNear(b: MapBuilder, rng: Rng, spawn: Vec2, type: ResourceNodeType, count: number, minDist: number, maxDist: number): void {
  for (let tries = 0; tries < 80; tries++) {
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(minDist, maxDist);
    const x = Math.floor(spawn.x + Math.cos(angle) * dist);
    const y = Math.floor(spawn.y + Math.sin(angle) * dist);
    if (growCluster(b, rng, x, y, type, count)) return;
  }
}

function countNear(b: MapBuilder, spawn: Vec2, type: ResourceNodeType, radius: number): number {
  return b.resources.filter((r) => r.type === type && Math.hypot(r.x + 0.5 - spawn.x, r.y + 0.5 - spawn.y) <= radius).length;
}

function placeStartingResources(b: MapBuilder, rng: Rng, spawn: Vec2): void {
  placeNear(b, rng, spawn, 'berryBush', 6, 6, 8);
  placeNear(b, rng, spawn, 'goldMine', 7, 7.5, 10.5);
  placeNear(b, rng, spawn, 'stoneMine', 5, 8, 11.5);
  if (countNear(b, spawn, 'tree', 13) < 25) placeNear(b, rng, spawn, 'tree', 22, 9, 13);
}

function scatterResources(b: MapBuilder, rng: Rng): void {
  const clusters = Math.round((b.size * b.size) / 1800);
  const kinds: ReadonlyArray<[ResourceNodeType, number]> = [
    ['goldMine', 4],
    ['stoneMine', 3],
    ['berryBush', 5],
  ];
  for (let k = 0; k < clusters; k++) {
    const [type, count] = kinds[k % kinds.length]!;
    for (let tries = 0; tries < 30; tries++) {
      const x = rng.int(2, b.size - 3);
      const y = rng.int(2, b.size - 3);
      if ((b.spawnDistance[y * b.size + x] as number) < 16) continue;
      if (growCluster(b, rng, x, y, type, count)) break;
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
