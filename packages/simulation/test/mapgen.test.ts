import { getTerrain } from '@eoc/game-data';
import { describe, expect, it } from 'vitest';
import { generateMap } from '../src/map/generateMap';
import { startFootprint } from '../src/map/types';
import { validateMap } from '../src/map/validateMap';

describe('Geração de mapas', () => {
  it('é reproduzível pela seed', () => {
    const a = generateMap({ seed: 1234, size: 64, playerCount: 2 });
    const b = generateMap({ seed: 1234, size: 64, playerCount: 2 });
    expect(a.terrain).toEqual(b.terrain);
    expect(a.resources).toEqual(b.resources);
    expect(a.spawns).toEqual(b.spawns);
  });

  it('gera mapas diferentes para seeds diferentes', () => {
    const a = generateMap({ seed: 1, size: 64, playerCount: 2 });
    const b = generateMap({ seed: 2, size: 64, playerCount: 2 });
    expect(a.terrain).not.toEqual(b.terrain);
  });

  it.each([
    [64, 2],
    [128, 2],
    [128, 4],
    [256, 2],
  ])('gera mapas válidos (%i tiles, %i jogadores) em várias seeds', (size, players) => {
    const seeds = size === 256 ? [11, 22] : [1, 2, 3, 4, 5, 6, 7, 8];
    for (const seed of seeds) {
      const map = generateMap({ seed, size, playerCount: players });
      expect(map.width).toBe(size);
      expect(map.spawns).toHaveLength(players);
      expect(validateMap(map).valid).toBe(true);
    }
  });

  it('cria rios com vaus quando solicitado, mantendo a conectividade', () => {
    const map = generateMap({ seed: 99, size: 128, playerCount: 2, river: true });
    expect(validateMap(map).valid).toBe(true);
    const water = map.terrain.filter((t) => !getTerrain(t).walkable).length;
    expect(water).toBeGreaterThan(0);
  });

  it('mantém a área do Centro da Vila livre e edificável', () => {
    const map = generateMap({ seed: 5, size: 64, playerCount: 2 });
    for (const spawn of map.spawns) {
      const fp = startFootprint(spawn);
      for (let y = fp.y; y < fp.y + fp.h; y++) {
        for (let x = fp.x; x < fp.x + fp.w; x++) {
          expect(getTerrain(map.terrain[y * map.width + x]!).buildable).toBe(true);
          expect(map.resources.some((r) => r.x === x && r.y === y)).toBe(false);
        }
      }
    }
  });

  it('detecta mapas inválidos na validação', () => {
    const map = generateMap({ seed: 5, size: 64, playerCount: 2 });
    const broken = { ...map, resources: map.resources.filter((r) => r.type !== 'goldMine') };
    const report = validateMap(broken);
    expect(report.valid).toBe(false);
    expect(report.issues.join(' ')).toContain('goldMine');
  });
});
