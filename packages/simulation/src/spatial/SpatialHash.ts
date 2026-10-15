/**
 * Hash espacial em grade uniforme para consultas de proximidade.
 * Reconstruído a cada tick com listas encadeadas em arrays tipados (sem alocações por frame).
 */
export class SpatialHash {
  private readonly cols: number;
  private readonly rows: number;
  private readonly heads: Int32Array;
  private next = new Int32Array(64);
  private xs = new Float32Array(64);
  private ys = new Float32Array(64);
  private count = 0;

  constructor(
    worldWidth: number,
    worldHeight: number,
    private readonly cellSize = 2,
  ) {
    this.cols = Math.max(1, Math.ceil(worldWidth / cellSize));
    this.rows = Math.max(1, Math.ceil(worldHeight / cellSize));
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
  }

  clear(): void {
    this.heads.fill(-1);
    this.count = 0;
  }

  /** Insere o item de índice `this.count` e retorna esse índice. */
  insert(x: number, y: number): number {
    const i = this.count++;
    if (i >= this.next.length) this.grow();
    this.xs[i] = x;
    this.ys[i] = y;
    const cell = this.cellOf(x, y);
    this.next[i] = this.heads[cell] as number;
    this.heads[cell] = i;
    return i;
  }

  /** Coleta em `out` os índices de itens a até `radius` de (x, y). */
  queryRadius(x: number, y: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const r2 = radius * radius;
    const minCx = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        let i = this.heads[cy * this.cols + cx] as number;
        while (i !== -1) {
          const dx = (this.xs[i] as number) - x;
          const dy = (this.ys[i] as number) - y;
          if (dx * dx + dy * dy <= r2) out.push(i);
          i = this.next[i] as number;
        }
      }
    }
    return out;
  }

  private cellOf(x: number, y: number): number {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
    return cy * this.cols + cx;
  }

  private grow(): void {
    const size = this.next.length * 2;
    const next = new Int32Array(size);
    next.set(this.next);
    const xs = new Float32Array(size);
    xs.set(this.xs);
    const ys = new Float32Array(size);
    ys.set(this.ys);
    this.next = next;
    this.xs = xs;
    this.ys = ys;
  }
}
