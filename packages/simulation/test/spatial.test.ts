import { describe, expect, it } from 'vitest';
import { SpatialHash } from '../src/spatial/SpatialHash';

describe('SpatialHash', () => {
  it('retorna apenas itens dentro do raio', () => {
    const hash = new SpatialHash(32, 32, 2);
    hash.insert(1, 1);
    hash.insert(1.5, 1);
    hash.insert(10, 10);
    const out: number[] = [];
    hash.queryRadius(1, 1, 1, out);
    expect(out.sort()).toEqual([0, 1]);
  });

  it('cresce além da capacidade inicial', () => {
    const hash = new SpatialHash(64, 64, 4);
    for (let i = 0; i < 500; i++) hash.insert((i * 7) % 64, (i * 13) % 64);
    const out: number[] = [];
    hash.queryRadius(32, 32, 100, out);
    expect(out).toHaveLength(500);
  });
});
