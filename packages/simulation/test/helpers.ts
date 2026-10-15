import { Terrain, TICK_RATE } from '@eoc/shared';
import { createPlayerState } from '../src/core/players';
import { Simulation } from '../src/core/Simulation';
import { World } from '../src/core/World';
import type { GeneratedMap } from '../src/map/types';
import { NavGrid } from '../src/pathfinding/NavGrid';

/** '.' livre, '#' montanha (bloqueado), '~' água, '=' estrada. */
function terrainFromAscii(rows: string[]): Uint8Array {
  const width = rows[0]!.length;
  const terrain = new Uint8Array(width * rows.length);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      terrain[y * width + x] = ch === '#' ? Terrain.Mountain : ch === '~' ? Terrain.Water : ch === '=' ? Terrain.Road : Terrain.Grass;
    });
  });
  return terrain;
}

/** Cria uma NavGrid a partir de um desenho ASCII. */
export function gridFromAscii(rows: string[]): NavGrid {
  return new NavGrid(rows[0]!.length, rows.length, terrainFromAscii(rows));
}

/** Simulação com dois jogadores (1 e 2) em um mapa ASCII, sem entidades. */
export function asciiSim(rows: string[]): Simulation {
  const map: GeneratedMap = { seed: 0, attempt: 0, width: rows[0]!.length, height: rows.length, terrain: terrainFromAscii(rows), spawns: [], resources: [] };
  const world = new World(map);
  const zero = { food: 0, wood: 0, gold: 0, stone: 0 };
  world.addPlayer(createPlayerState({ id: 1, name: 'A', color: 0, isHuman: true, resources: zero }));
  world.addPlayer(createPlayerState({ id: 2, name: 'B', color: 0, isHuman: false, resources: zero }));
  return new Simulation(world);
}

/** Mapa ASCII retangular totalmente livre. */
export function openRows(width: number, height: number): string[] {
  return Array.from({ length: height }, () => '.'.repeat(width));
}

export function runSeconds(sim: Simulation, seconds: number, onTick?: () => void): void {
  for (let i = 0; i < Math.round(seconds * TICK_RATE); i++) {
    sim.step();
    onTick?.();
  }
}
