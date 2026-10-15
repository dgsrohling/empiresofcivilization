import { describe, expect, it } from 'vitest';
import { TILE_H, TILE_W, mapScreenBounds, screenToWorld, worldToScreen } from '../src/game/iso';

describe('Projeção isométrica', () => {
  it('worldToScreen e screenToWorld são inversas', () => {
    for (const [x, y] of [
      [0, 0],
      [10.25, 3.5],
      [127.9, 0.1],
      [64, 64],
    ] as const) {
      const s = worldToScreen(x, y);
      const w = screenToWorld(s.x, s.y);
      expect(w.x).toBeCloseTo(x, 9);
      expect(w.y).toBeCloseTo(y, 9);
    }
  });

  it('usa proporção 2:1 por tile', () => {
    expect(worldToScreen(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
    expect(worldToScreen(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 });
  });

  it('limites do mapa contêm os quatro cantos', () => {
    const b = mapScreenBounds(64, 64);
    for (const [x, y] of [
      [0, 0],
      [64, 0],
      [0, 64],
      [64, 64],
    ] as const) {
      const s = worldToScreen(x, y);
      expect(s.x).toBeGreaterThanOrEqual(b.x);
      expect(s.x).toBeLessThanOrEqual(b.x + b.width);
      expect(s.y).toBeGreaterThanOrEqual(b.y);
      expect(s.y).toBeLessThanOrEqual(b.y + b.height);
    }
  });
});
