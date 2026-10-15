import { getTerrain } from '@eoc/game-data';
import type { Vec2 } from '@eoc/shared';
import type { CostGrid } from './AStar';

/**
 * Grade de navegação: custo de cada tile considerando terreno e objetos estáticos
 * (edifícios, árvores, minas). Unidades NÃO bloqueiam a grade; a sobreposição entre
 * unidades é resolvida pela separação no sistema de movimento.
 */
export class NavGrid implements CostGrid {
  readonly width: number;
  readonly height: number;
  readonly costs: Float32Array;
  readonly minCost: number;
  private readonly terrainCost: Float32Array;
  private readonly blockers: Uint16Array;
  private readonly components: Int32Array;
  private componentsDirty = true;
  /** Incrementado a cada alteração de bloqueio (invalida caches de caminho). */
  version = 0;

  constructor(width: number, height: number, terrain: Uint8Array) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.terrainCost = new Float32Array(size);
    this.costs = new Float32Array(size);
    this.blockers = new Uint16Array(size);
    this.components = new Int32Array(size);
    let minCost = Infinity;
    for (let i = 0; i < size; i++) {
      const def = getTerrain(terrain[i] as number);
      const cost = def.walkable ? 1 / def.speedMultiplier : Infinity;
      this.terrainCost[i] = cost;
      this.costs[i] = cost;
      if (cost < minCost) minCost = cost;
    }
    this.minCost = Number.isFinite(minCost) ? minCost : 1;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  index(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  isWalkable(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && Number.isFinite(this.costs[ty * this.width + tx] as number);
  }

  /** Verifica um ponto em coordenadas de mundo (frações de tile). */
  isWalkableAt(wx: number, wy: number): boolean {
    return this.isWalkable(Math.floor(wx), Math.floor(wy));
  }

  /** Marca (ou desmarca) uma área retangular de tiles como ocupada por objeto estático. */
  setBlocked(tx: number, ty: number, w: number, h: number, blocked: boolean): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = y * this.width + x;
        const count = this.blockers[i] as number;
        this.blockers[i] = blocked ? count + 1 : Math.max(0, count - 1);
        this.costs[i] = (this.blockers[i] as number) > 0 ? Infinity : (this.terrainCost[i] as number);
      }
    }
    this.version++;
    this.componentsDirty = true;
  }

  /** Componente conexo do tile (-1 se bloqueado). Recalculado sob demanda. */
  componentAt(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) return -1;
    if (this.componentsDirty) this.computeComponents();
    return this.components[ty * this.width + tx] as number;
  }

  /**
   * Procura o tile transitável mais próximo (busca em anéis crescentes).
   * Se `component` for informado, só aceita tiles desse componente.
   */
  findNearestWalkable(tx: number, ty: number, component: number | null = null, maxRadius = 64): Vec2 | null {
    const cx = Math.max(0, Math.min(this.width - 1, tx));
    const cy = Math.max(0, Math.min(this.height - 1, ty));
    for (let r = 0; r <= maxRadius; r++) {
      let best: Vec2 | null = null;
      let bestDist = Infinity;
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
          if (!this.isWalkable(x, y)) continue;
          if (component !== null && this.componentAt(x, y) !== component) continue;
          const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
          if (d < bestDist) {
            bestDist = d;
            best = { x, y };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  private computeComponents(): void {
    const { width, height, components } = this;
    components.fill(-1);
    const stack: number[] = [];
    let label = 0;
    for (let start = 0; start < components.length; start++) {
      if (components[start] !== -1 || !Number.isFinite(this.costs[start] as number)) continue;
      components[start] = label;
      stack.push(start);
      while (stack.length > 0) {
        const idx = stack.pop() as number;
        const x = idx % width;
        const y = (idx / width) | 0;
        if (x > 0) this.visit(idx - 1, label, stack);
        if (x < width - 1) this.visit(idx + 1, label, stack);
        if (y > 0) this.visit(idx - width, label, stack);
        if (y < height - 1) this.visit(idx + width, label, stack);
      }
      label++;
    }
    this.componentsDirty = false;
  }

  private visit(idx: number, label: number, stack: number[]): void {
    if (this.components[idx] !== -1 || !Number.isFinite(this.costs[idx] as number)) return;
    this.components[idx] = label;
    stack.push(idx);
  }
}
