import { getTerrain } from '@eoc/game-data';
import type { EntityId, Vec2 } from '@eoc/shared';
import type { World } from '../core/World';
import type { UnitEntity } from '../entities/types';
import type { PathService } from '../pathfinding/PathService';
import { hasLineOfSight } from '../pathfinding/smoothing';
import { SpatialHash } from '../spatial/SpatialHash';

const STUCK_CHECK_INTERVAL = 1;
const MAX_REPATHS = 3;
const ARRIVE_EPSILON = 0.02;
/** Fração da sobreposição corrigida por tick (separação suave). */
const SEPARATION_STRENGTH = 0.5;
const MAX_PUSH_PER_TICK = 0.08;

/**
 * Movimento das unidades: segue waypoints, respeita o terreno, detecta bloqueios
 * e separa unidades sobrepostas. Nunca posiciona uma unidade em tile intransitável.
 */
export class MovementSystem {
  private readonly hash: SpatialHash;
  private readonly neighbors: number[] = [];
  private pushX = new Float32Array(0);
  private pushY = new Float32Array(0);
  private gridVersion = -1;

  constructor(
    private readonly world: World,
    private readonly paths: PathService,
  ) {
    this.hash = new SpatialHash(world.width, world.height, 2);
  }

  /**
   * Inicia o deslocamento de uma unidade para `goal` (o caminho é calculado de forma assíncrona).
   * Não altera a tarefa nem o estado visível — isso cabe a quem deu a ordem.
   */
  moveUnit(unit: UnitEntity, goal: Vec2): void {
    unit.moveGoal = { x: goal.x, y: goal.y };
    unit.moveStatus = 'moving';
    unit.path = [];
    unit.pathIndex = 0;
    unit.repathCount = 0;
    this.requestPath(unit);
  }

  /** Interrompe o deslocamento, registrando o motivo em `moveStatus`. */
  stopMovement(unit: UnitEntity, status: 'none' | 'arrived' | 'failed' = 'none'): void {
    unit.moveGoal = null;
    unit.moveStatus = status;
    unit.path = [];
    unit.pathIndex = 0;
    unit.awaitingPath = false;
    this.paths.cancel(unit.id);
  }

  update(dt: number): void {
    if (this.gridVersion !== this.world.grid.version) {
      this.gridVersion = this.world.grid.version;
      this.revalidatePaths();
    }
    this.paths.process(this.onPath);
    for (const unit of this.world.units) {
      if (unit.moveGoal) this.followPath(unit, dt);
    }
    this.separate();
  }

  private readonly onPath = (unitId: EntityId, path: Vec2[] | null): void => {
    const unit = this.world.getEntity(unitId);
    if (!unit || unit.kind !== 'unit' || !unit.moveGoal) return;
    unit.awaitingPath = false;
    if (!path || path.length === 0) {
      this.stopMovement(unit, 'failed');
      return;
    }
    unit.path = path;
    unit.pathIndex = 0;
    unit.stuckTimer = 0;
    unit.stuckCheckX = unit.x;
    unit.stuckCheckY = unit.y;
  };

  /** Após mudanças na grade (nova obra, recurso esgotado), recalcula caminhos que ficaram obstruídos. */
  private revalidatePaths(): void {
    const grid = this.world.grid;
    for (const unit of this.world.units) {
      if (!unit.moveGoal || unit.awaitingPath) continue;
      let fromX = unit.x;
      let fromY = unit.y;
      for (let i = unit.pathIndex; i < unit.path.length; i++) {
        const wp = unit.path[i]!;
        if (!hasLineOfSight(grid, fromX, fromY, wp.x, wp.y, 0)) {
          unit.repathCount = 0;
          this.requestPath(unit);
          break;
        }
        fromX = wp.x;
        fromY = wp.y;
      }
    }
  }

  private requestPath(unit: UnitEntity): void {
    if (!unit.moveGoal) return;
    unit.awaitingPath = true;
    this.paths.request({ unitId: unit.id, fromX: unit.x, fromY: unit.y, toX: unit.moveGoal.x, toY: unit.moveGoal.y, radius: unit.radius });
  }

  private followPath(unit: UnitEntity, dt: number): void {
    if (unit.awaitingPath) return;
    const grid = this.world.grid;
    const terrain = this.world.map.terrain[Math.floor(unit.y) * this.world.width + Math.floor(unit.x)] ?? 0;
    let remaining = unit.speed * Math.max(0.1, getTerrain(terrain).speedMultiplier) * dt;

    while (remaining > 1e-6 && unit.pathIndex < unit.path.length) {
      const wp = unit.path[unit.pathIndex]!;
      const dx = wp.x - unit.x;
      const dy = wp.y - unit.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= Math.max(remaining, ARRIVE_EPSILON)) {
        if (grid.isWalkableAt(wp.x, wp.y)) {
          unit.x = wp.x;
          unit.y = wp.y;
        }
        remaining -= dist;
        unit.pathIndex++;
        continue;
      }
      const mx = (dx / dist) * remaining;
      const my = (dy / dist) * remaining;
      unit.heading = Math.atan2(dy, dx);
      this.tryMove(unit, mx, my);
      remaining = 0;
    }

    if (unit.pathIndex >= unit.path.length) {
      this.stopMovement(unit, 'arrived');
      return;
    }

    // Detecção de bloqueio: se quase não houve progresso, recalcula o caminho.
    unit.stuckTimer += dt;
    if (unit.stuckTimer >= STUCK_CHECK_INTERVAL) {
      const progress = Math.hypot(unit.x - unit.stuckCheckX, unit.y - unit.stuckCheckY);
      unit.stuckTimer = 0;
      unit.stuckCheckX = unit.x;
      unit.stuckCheckY = unit.y;
      if (progress < unit.speed * STUCK_CHECK_INTERVAL * 0.2) {
        const goal = unit.moveGoal;
        if (!goal || Math.hypot(goal.x - unit.x, goal.y - unit.y) < 1) {
          this.stopMovement(unit, 'arrived');
        } else if (unit.repathCount >= MAX_REPATHS) {
          this.stopMovement(unit, 'failed');
        } else {
          unit.repathCount++;
          this.requestPath(unit);
        }
      }
    }
  }

  /** Move com deslizamento por eixo quando o movimento completo entraria em tile bloqueado. */
  private tryMove(unit: UnitEntity, dx: number, dy: number): boolean {
    const grid = this.world.grid;
    const nx = unit.x + dx;
    const ny = unit.y + dy;
    if (grid.isWalkableAt(nx, ny)) {
      unit.x = nx;
      unit.y = ny;
      return true;
    }
    if (dx !== 0 && grid.isWalkableAt(nx, unit.y)) {
      unit.x = nx;
      return true;
    }
    if (dy !== 0 && grid.isWalkableAt(unit.x, ny)) {
      unit.y = ny;
      return true;
    }
    return false;
  }

  /** Empurra unidades sobrepostas. Unidades ociosas cedem espaço às que se movem ou trabalham. */
  private separate(): void {
    const units = this.world.units;
    const n = units.length;
    if (n < 2) return;
    if (this.pushX.length < n) {
      this.pushX = new Float32Array(n * 2);
      this.pushY = new Float32Array(n * 2);
    }
    const pushX = this.pushX;
    const pushY = this.pushY;
    pushX.fill(0, 0, n);
    pushY.fill(0, 0, n);

    this.hash.clear();
    let maxRadius = 0;
    for (const u of units) {
      this.hash.insert(u.x, u.y);
      if (u.radius > maxRadius) maxRadius = u.radius;
    }

    for (let i = 0; i < n; i++) {
      const a = units[i]!;
      this.hash.queryRadius(a.x, a.y, a.radius + maxRadius, this.neighbors);
      for (const j of this.neighbors) {
        if (j <= i) continue;
        const b = units[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const overlap = a.radius + b.radius - dist;
        if (overlap <= 0) continue;
        if (dist < 1e-4) {
          // Direção determinística para unidades exatamente sobrepostas.
          const angle = ((a.id * 7919 + b.id * 104729) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const ux = dx / dist;
        const uy = dy / dist;
        const aMoving = a.moveGoal !== null || a.state === 'gathering';
        const bMoving = b.moveGoal !== null || b.state === 'gathering';
        const wa = aMoving === bMoving ? 0.5 : aMoving ? 0.15 : 0.85;
        const amount = overlap * SEPARATION_STRENGTH;
        pushX[i] = (pushX[i] as number) - ux * amount * wa;
        pushY[i] = (pushY[i] as number) - uy * amount * wa;
        pushX[j] = (pushX[j] as number) + ux * amount * (1 - wa);
        pushY[j] = (pushY[j] as number) + uy * amount * (1 - wa);
      }
    }

    for (let i = 0; i < n; i++) {
      let px = pushX[i] as number;
      let py = pushY[i] as number;
      if (px === 0 && py === 0) continue;
      const len = Math.hypot(px, py);
      if (len > MAX_PUSH_PER_TICK) {
        px = (px / len) * MAX_PUSH_PER_TICK;
        py = (py / len) * MAX_PUSH_PER_TICK;
      }
      this.tryMove(units[i]!, px, py);
    }
  }
}
