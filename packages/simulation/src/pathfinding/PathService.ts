import type { EntityId, Vec2 } from '@eoc/shared';
import { AStar } from './AStar';
import type { NavGrid } from './NavGrid';
import { smoothPath } from './smoothing';

export interface PathRequest {
  unitId: EntityId;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  radius: number;
}

export type PathResultHandler = (unitId: EntityId, path: Vec2[] | null) => void;

const CACHE_LIMIT = 512;

/**
 * Serviço de caminhos com fila e orçamento por tick: evita calcular A* para
 * muitas unidades no mesmo frame. Resultados brutos (tiles) são cacheados até
 * a grade mudar.
 */
export class PathService {
  private readonly astar = new AStar();
  private readonly pending = new Map<EntityId, PathRequest>();
  private queue: EntityId[] = [];
  private head = 0;
  private readonly cache = new Map<string, number[]>();
  private cacheVersion = -1;
  stats = { computed: 0, cacheHits: 0 };

  constructor(
    private readonly grid: NavGrid,
    private readonly budgetPerTick = 24,
  ) {}

  get pendingCount(): number {
    return this.pending.size;
  }

  request(req: PathRequest): void {
    if (!this.pending.has(req.unitId)) this.queue.push(req.unitId);
    this.pending.set(req.unitId, req);
  }

  cancel(unitId: EntityId): void {
    this.pending.delete(unitId);
  }

  /** Processa até `budgetPerTick` pedidos, na ordem de chegada. */
  process(onResult: PathResultHandler): void {
    let processed = 0;
    while (processed < this.budgetPerTick && this.head < this.queue.length) {
      const unitId = this.queue[this.head++] as EntityId;
      const req = this.pending.get(unitId);
      if (!req) continue;
      this.pending.delete(unitId);
      onResult(unitId, this.computePath(req));
      processed++;
    }
    if (this.head > 256 && this.head * 2 > this.queue.length) {
      this.queue = this.queue.slice(this.head);
      this.head = 0;
    }
  }

  /**
   * Calcula o caminho (lista de waypoints em coordenadas de mundo, sem a posição inicial).
   * Se o destino for inalcançável, segue até o tile alcançável mais próximo dele.
   */
  computePath(req: PathRequest): Vec2[] | null {
    const grid = this.grid;
    let sx = Math.floor(req.fromX);
    let sy = Math.floor(req.fromY);
    let fromX = req.fromX;
    let fromY = req.fromY;
    if (!grid.isWalkable(sx, sy)) {
      const near = grid.findNearestWalkable(sx, sy, null, 8);
      if (!near) return null;
      sx = near.x;
      sy = near.y;
      fromX = sx + 0.5;
      fromY = sy + 0.5;
    }
    const component = grid.componentAt(sx, sy);

    let gx = Math.floor(req.toX);
    let gy = Math.floor(req.toY);
    let goalX = req.toX;
    let goalY = req.toY;
    if (!grid.isWalkable(gx, gy) || grid.componentAt(gx, gy) !== component) {
      const near = grid.findNearestWalkable(gx, gy, component, Math.max(grid.width, grid.height));
      if (!near) return null;
      gx = near.x;
      gy = near.y;
      goalX = gx + 0.5;
      goalY = gy + 0.5;
    }

    const start = grid.index(sx, sy);
    const goal = grid.index(gx, gy);
    if (start === goal) return [{ x: goalX, y: goalY }];

    const tiles = this.findTilePath(start, goal);
    if (tiles.length === 0) return null;

    const points: Vec2[] = [{ x: fromX, y: fromY }];
    for (let i = 1; i < tiles.length - 1; i++) {
      const idx = tiles[i] as number;
      points.push({ x: (idx % grid.width) + 0.5, y: Math.floor(idx / grid.width) + 0.5 });
    }
    points.push({ x: goalX, y: goalY });
    return smoothPath(grid, points, req.radius).slice(1);
  }

  private findTilePath(start: number, goal: number): number[] {
    if (this.cacheVersion !== this.grid.version) {
      this.cache.clear();
      this.cacheVersion = this.grid.version;
    }
    const key = `${start}:${goal}`;
    const cached = this.cache.get(key);
    if (cached) {
      this.stats.cacheHits++;
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const result = this.astar.findPath(this.grid, start, goal);
    this.stats.computed++;
    this.cache.set(key, result.path);
    if (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return result.path;
  }
}
