import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/core/createMatch';
import type { UnitEntity } from '../src/entities/types';
import { distributeDestinations } from '../src/movement/formation';
import { asciiSim, gridFromAscii, runSeconds } from './helpers';

const PLAYERS = [
  { id: 1, name: 'Jogador', color: 0x2f6fd6, isHuman: true },
  { id: 2, name: 'Rival', color: 0xc8382f, isHuman: false },
];

describe('createMatch', () => {
  it('cria Centro da Vila, 5 aldeões e 1 batedor por jogador', () => {
    const sim = createMatch({ seed: 7, mapSize: 64, players: PLAYERS });
    for (const p of PLAYERS) {
      const units = sim.world.units.filter((u) => u.owner === p.id);
      expect(units.filter((u) => u.type === 'villager')).toHaveLength(5);
      expect(units.filter((u) => u.type === 'scout')).toHaveLength(1);
      expect(sim.world.buildings.filter((b) => b.owner === p.id && b.type === 'townCenter')).toHaveLength(1);
      const player = sim.world.getPlayer(p.id)!;
      expect(player.population).toBe(6);
      expect(player.populationCap).toBeGreaterThanOrEqual(6);
      for (const u of units) expect(sim.world.grid.isWalkableAt(u.x, u.y)).toBe(true);
    }
  });
});

describe('Comandos', () => {
  it('rejeita comandos sobre unidades de outro jogador', () => {
    const sim = createMatch({ seed: 7, mapSize: 64, players: PLAYERS });
    const enemy = sim.world.units.find((u) => u.owner === 2)!;
    const result = sim.issue(1, { type: 'move', unitIds: [enemy.id], target: { x: 10, y: 10 } });
    expect(result.ok).toBe(false);
  });

  it('rejeita destino não numérico e lista vazia', () => {
    const sim = createMatch({ seed: 7, mapSize: 64, players: PLAYERS });
    const own = sim.world.units.find((u) => u.owner === 1)!;
    expect(sim.issue(1, { type: 'move', unitIds: [own.id], target: { x: NaN, y: 1 } }).ok).toBe(false);
    expect(sim.issue(1, { type: 'move', unitIds: [], target: { x: 1, y: 1 } }).ok).toBe(false);
  });

  it('stop interrompe o movimento', () => {
    const sim = asciiSim(['..........', '..........']);
    const u = sim.world.addUnit('villager', 1, 0.5, 0.5);
    sim.issue(1, { type: 'move', unitIds: [u.id], target: { x: 9.5, y: 0.5 } });
    runSeconds(sim, 0.5);
    expect(u.state).toBe('moving');
    sim.issue(1, { type: 'stop', unitIds: [u.id] });
    sim.step();
    expect(u.state).toBe('idle');
    const x = u.x;
    runSeconds(sim, 1);
    expect(u.x).toBeCloseTo(x, 5);
  });
});

describe('Movimento', () => {
  it('unidade contorna parede e chega ao destino sem pisar em tiles bloqueados', () => {
    const rows = ['..........', '.########.', '........#.', '#######.#.', '..........'];
    const sim = asciiSim(rows);
    const u = sim.world.addUnit('villager', 1, 0.5, 0.5);
    sim.issue(1, { type: 'move', unitIds: [u.id], target: { x: 0.5, y: 4.5 } });
    runSeconds(sim, 30, () => expect(sim.world.grid.isWalkableAt(u.x, u.y)).toBe(true));
    expect(u.state).toBe('idle');
    expect(Math.hypot(u.x - 0.5, u.y - 4.5)).toBeLessThan(0.3);
  });

  it('em mapa procedural, grupo chega perto do destino sem atravessar obstáculos', () => {
    const sim = createMatch({ seed: 3, mapSize: 64, players: PLAYERS });
    const units = sim.world.units.filter((u) => u.owner === 1);
    const enemyTc = sim.world.buildings.find((b) => b.owner === 2)!;
    const target = { x: enemyTc.tileX - 3, y: enemyTc.tileY - 3 };
    // Só o pathfinding interessa aqui: remove o rival para que ninguém entre em combate.
    for (const e of [...sim.world.entities.values()]) if (e.owner === 2) sim.world.removeEntity(e.id);
    expect(sim.issue(1, { type: 'move', unitIds: units.map((u) => u.id), target }).ok).toBe(true);
    runSeconds(sim, 90, () => {
      for (const u of units) expect(sim.world.grid.isWalkableAt(u.x, u.y)).toBe(true);
    });
    for (const u of units) {
      expect(u.state).toBe('idle');
      expect(Math.hypot(u.x - target.x, u.y - target.y)).toBeLessThan(6);
    }
  });

  it('separa unidades sobrepostas', () => {
    const sim = asciiSim(['......', '......', '......', '......']);
    const a = sim.world.addUnit('villager', 1, 2.5, 2.5);
    const b = sim.world.addUnit('villager', 1, 2.5, 2.5);
    runSeconds(sim, 2);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan((a.radius + b.radius) * 0.9);
  });

  it('é determinística: mesma seed e comandos produzem o mesmo estado', () => {
    const run = () => {
      const sim = createMatch({ seed: 21, mapSize: 64, players: PLAYERS });
      const ids = sim.world.units.filter((u) => u.owner === 1).map((u) => u.id);
      sim.issue(1, { type: 'move', unitIds: ids, target: { x: 32, y: 32 } });
      runSeconds(sim, 10);
      return sim.world.units.map((u: UnitEntity) => [u.x, u.y]);
    };
    expect(run()).toEqual(run());
  });
});

describe('Formação', () => {
  it('distribui destinos distintos e transitáveis', () => {
    const grid = gridFromAscii(Array.from({ length: 12 }, () => '............'));
    const members = Array.from({ length: 8 }, (_, i) => ({ x: 0.5 + i, y: 0.5, radius: 0.25 }));
    const slots = distributeDestinations(grid, { x: 6, y: 6 }, members);
    expect(slots).toHaveLength(8);
    const keys = new Set(slots.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`));
    expect(keys.size).toBe(8);
    for (const s of slots) expect(grid.isWalkableAt(s.x, s.y)).toBe(true);
  });

  it('não posiciona vagas do outro lado de obstáculos', () => {
    const grid = gridFromAscii(['.....#.....', '.....#.....', '.....#.....']);
    const members = Array.from({ length: 6 }, () => ({ x: 0.5, y: 1.5, radius: 0.25 }));
    const slots = distributeDestinations(grid, { x: 4.5, y: 1.5 }, members);
    for (const s of slots) expect(s.x).toBeLessThan(5);
  });
});
