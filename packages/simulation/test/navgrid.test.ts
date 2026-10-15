import { describe, expect, it } from 'vitest';
import { PathService } from '../src/pathfinding/PathService';
import { hasLineOfSight, smoothPath } from '../src/pathfinding/smoothing';
import { gridFromAscii } from './helpers';

describe('NavGrid', () => {
  it('bloqueia e desbloqueia áreas, alterando a versão', () => {
    const grid = gridFromAscii(['....', '....']);
    const v = grid.version;
    grid.setBlocked(1, 0, 2, 1, true);
    expect(grid.isWalkable(1, 0)).toBe(false);
    expect(grid.isWalkable(2, 0)).toBe(false);
    expect(grid.version).toBeGreaterThan(v);
    grid.setBlocked(1, 0, 2, 1, false);
    expect(grid.isWalkable(1, 0)).toBe(true);
  });

  it('identifica componentes conexos separados por água', () => {
    const grid = gridFromAscii(['..~..', '..~..']);
    expect(grid.componentAt(0, 0)).toBe(grid.componentAt(1, 1));
    expect(grid.componentAt(0, 0)).not.toBe(grid.componentAt(4, 0));
    expect(grid.componentAt(2, 0)).toBe(-1);
  });

  it('encontra o tile transitável mais próximo dentro do componente', () => {
    const grid = gridFromAscii(['..~~~..', '..~~~..']);
    const comp = grid.componentAt(0, 0);
    const near = grid.findNearestWalkable(4, 0, comp);
    expect(near).toEqual({ x: 1, y: 0 });
  });
});

describe('Linha de visão e suavização', () => {
  it('detecta obstáculo entre dois pontos', () => {
    const grid = gridFromAscii(['.....', '..#..', '.....']);
    expect(hasLineOfSight(grid, 0.5, 1.5, 4.5, 1.5, 0)).toBe(false);
    expect(hasLineOfSight(grid, 0.5, 0.5, 4.5, 0.5, 0)).toBe(true);
  });

  it('remove waypoints colineares desnecessários', () => {
    const grid = gridFromAscii(['......']);
    const pts = [0, 1, 2, 3, 4, 5].map((x) => ({ x: x + 0.5, y: 0.5 }));
    expect(smoothPath(grid, pts, 0.2)).toEqual([pts[0], pts[5]]);
  });
});

describe('PathService', () => {
  it('leva ao tile alcançável mais próximo quando o destino está do outro lado da água', () => {
    const grid = gridFromAscii(['....~~....', '....~~....']);
    const service = new PathService(grid);
    const path = service.computePath({ unitId: 1, fromX: 0.5, fromY: 0.5, toX: 8.5, toY: 0.5, radius: 0.25 });
    expect(path).not.toBeNull();
    const end = path![path!.length - 1]!;
    expect(Math.floor(end.x)).toBe(3);
  });

  it('processa no máximo o orçamento de pedidos por tick', () => {
    const grid = gridFromAscii(['..........']);
    const service = new PathService(grid, 2);
    for (let id = 1; id <= 5; id++) service.request({ unitId: id, fromX: 0.5, fromY: 0.5, toX: 9.5, toY: 0.5, radius: 0.2 });
    const done: number[] = [];
    service.process((id) => done.push(id));
    expect(done).toEqual([1, 2]);
    expect(service.pendingCount).toBe(3);
  });

  it('usa cache para pedidos repetidos e invalida quando a grade muda', () => {
    const grid = gridFromAscii(['..........', '..........']);
    const service = new PathService(grid);
    const req = { unitId: 1, fromX: 0.5, fromY: 0.5, toX: 9.5, toY: 1.5, radius: 0.2 };
    service.computePath(req);
    service.computePath(req);
    expect(service.stats.cacheHits).toBe(1);
    grid.setBlocked(5, 0, 1, 1, true);
    service.computePath(req);
    expect(service.stats.computed).toBe(2);
  });
});
