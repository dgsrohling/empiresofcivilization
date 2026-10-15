import { describe, expect, it } from 'vitest';
import { Rng, seedFromString } from '../src/core/rng';

describe('Rng', () => {
  it('é determinístico para a mesma seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gera sequências diferentes para seeds diferentes', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('int respeita os limites inclusivos', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it('seedFromString aceita números e textos', () => {
    expect(seedFromString('1234')).toBe(1234);
    expect(seedFromString('valdoria')).toBe(seedFromString('valdoria'));
    expect(seedFromString('valdoria')).not.toBe(seedFromString('arkan'));
  });
});
