import { describe, expect, it } from 'vitest';
import { AStar } from '../src/pathfinding/AStar';
import { gridFromAscii } from './helpers';

const astar = new AStar();

function xy(width: number, idx: number) {
  return { x: idx % width, y: Math.floor(idx / width) };
}

describe('A*', () => {
  it('encontra caminho reto em mapa livre', () => {
    const grid = gridFromAscii(['.....', '.....', '.....']);
    const r = astar.findPath(grid, grid.index(0, 1), grid.index(4, 1));
    expect(r.found).toBe(true);
    expect(r.path.length).toBe(5);
  });

  it('contorna obstáculos e nunca passa por tiles bloqueados', () => {
    const rows = ['.......', '.#####.', '.....#.', '####.#.', '.......'];
    const grid = gridFromAscii(rows);
    const r = astar.findPath(grid, grid.index(0, 0), grid.index(0, 4));
    expect(r.found).toBe(true);
    for (const idx of r.path) {
      const p = xy(grid.width, idx);
      expect(rows[p.y]![p.x]).not.toBe('#');
    }
  });

  it('não corta quinas na diagonal', () => {
    const grid = gridFromAscii(['.#', '#.']);
    const r = astar.findPath(grid, grid.index(0, 0), grid.index(1, 1));
    expect(r.found).toBe(false);
  });

  it('retorna caminho parcial mais próximo quando o destino é inalcançável', () => {
    const grid = gridFromAscii(['...#.', '...#.', '...#.']);
    const r = astar.findPath(grid, grid.index(0, 1), grid.index(4, 1));
    expect(r.found).toBe(false);
    const last = xy(grid.width, r.path[r.path.length - 1]!);
    expect(last.x).toBe(2);
  });

  it('prefere estradas quando são mais rápidas', () => {
    const grid = gridFromAscii(['=========', '.........', '.........']);
    const r = astar.findPath(grid, grid.index(0, 1), grid.index(8, 1));
    expect(r.found).toBe(true);
    const onRoad = r.path.filter((idx) => xy(grid.width, idx).y === 0).length;
    expect(onRoad).toBeGreaterThan(3);
  });

  it('reutiliza buffers entre buscas sem contaminar resultados', () => {
    const grid = gridFromAscii(['....', '.##.', '....']);
    const a = astar.findPath(grid, grid.index(0, 0), grid.index(3, 2));
    const b = astar.findPath(grid, grid.index(0, 0), grid.index(3, 2));
    expect(a.path).toEqual(b.path);
  });
});
