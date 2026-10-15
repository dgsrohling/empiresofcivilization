import { MinHeap } from './MinHeap';

export interface CostGrid {
  readonly width: number;
  readonly height: number;
  /** Custo por tile; Infinity = bloqueado. */
  readonly costs: Float32Array;
  /** Menor custo possível de um tile (mantém a heurística admissível). */
  readonly minCost: number;
}

export interface AStarOptions {
  allowDiagonal?: boolean;
  /** Limite de nós expandidos; ao estourar retorna o caminho parcial mais próximo do objetivo. */
  maxExpanded?: number;
}

export interface AStarResult {
  /** true se o objetivo exato foi alcançado. */
  found: boolean;
  /** Índices de tile do início ao fim (inclusive). Vazio se nada pôde ser percorrido. */
  path: number[];
  expanded: number;
}

const SQRT2 = Math.SQRT2;
const DIRS_X = [1, -1, 0, 0, 1, 1, -1, -1];
const DIRS_Y = [0, 0, 1, -1, 1, -1, 1, -1];

/**
 * A* em grade com 8 direções, heurística octile e sem cortar quinas
 * (movimento diagonal só é permitido se os dois vizinhos ortogonais forem livres).
 * Os buffers são reaproveitados entre buscas via carimbos de geração para evitar alocações.
 */
export class AStar {
  private g = new Float32Array(0);
  private parent = new Int32Array(0);
  private openStamp = new Uint32Array(0);
  private closedStamp = new Uint32Array(0);
  private generation = 0;
  private heap = new MinHeap();

  private ensureCapacity(size: number): void {
    if (this.g.length >= size) return;
    this.g = new Float32Array(size);
    this.parent = new Int32Array(size);
    this.openStamp = new Uint32Array(size);
    this.closedStamp = new Uint32Array(size);
    this.generation = 0;
  }

  findPath(grid: CostGrid, start: number, goal: number, options: AStarOptions = {}): AStarResult {
    const { width, height, costs } = grid;
    const size = width * height;
    this.ensureCapacity(size);
    const allowDiagonal = options.allowDiagonal ?? true;
    const maxExpanded = options.maxExpanded ?? size;
    const hScale = grid.minCost;

    if (!Number.isFinite(costs[start] as number)) return { found: false, path: [], expanded: 0 };

    this.generation++;
    if (this.generation === 0xffffffff) {
      this.openStamp.fill(0);
      this.closedStamp.fill(0);
      this.generation = 1;
    }
    const gen = this.generation;
    const g = this.g;
    const parent = this.parent;
    const openStamp = this.openStamp;
    const closedStamp = this.closedStamp;
    const heap = this.heap;
    heap.clear();

    const gx = goal % width;
    const gy = (goal / width) | 0;
    const heuristic = (idx: number): number => {
      const dx = Math.abs((idx % width) - gx);
      const dy = Math.abs(((idx / width) | 0) - gy);
      const h = allowDiagonal ? Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy) : dx + dy;
      return h * hScale;
    };

    g[start] = 0;
    parent[start] = -1;
    openStamp[start] = gen;
    heap.push(heuristic(start), start);

    let bestIdx = start;
    let bestH = heuristic(start);
    let expanded = 0;
    const dirCount = allowDiagonal ? 8 : 4;

    while (heap.size > 0) {
      const current = heap.pop();
      if (closedStamp[current] === gen) continue;
      closedStamp[current] = gen;
      expanded++;

      if (current === goal) return { found: true, path: this.reconstruct(current), expanded };

      const hCurrent = heuristic(current);
      if (hCurrent < bestH) {
        bestH = hCurrent;
        bestIdx = current;
      }
      if (expanded >= maxExpanded) break;

      const cx = current % width;
      const cy = (current / width) | 0;
      const cCost = costs[current] as number;
      const gCurrent = g[current] as number;

      for (let d = 0; d < dirCount; d++) {
        const dx = DIRS_X[d] as number;
        const dy = DIRS_Y[d] as number;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        const nCost = costs[next] as number;
        if (!Number.isFinite(nCost) || closedStamp[next] === gen) continue;
        let step = 1;
        if (d >= 4) {
          // Sem cortar quinas: ambos os vizinhos ortogonais devem ser transitáveis.
          if (!Number.isFinite(costs[cy * width + nx] as number) || !Number.isFinite(costs[ny * width + cx] as number)) continue;
          step = SQRT2;
        }
        const tentative = gCurrent + step * (cCost + nCost) * 0.5;
        if (openStamp[next] === gen && tentative >= (g[next] as number)) continue;
        openStamp[next] = gen;
        g[next] = tentative;
        parent[next] = current;
        heap.push(tentative + heuristic(next), next);
      }
    }

    return { found: false, path: this.reconstruct(bestIdx), expanded };
  }

  private reconstruct(end: number): number[] {
    const path: number[] = [];
    let node = end;
    while (node !== -1) {
      path.push(node);
      node = this.parent[node] as number;
    }
    path.reverse();
    return path;
  }
}
