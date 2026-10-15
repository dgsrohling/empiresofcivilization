import { describe, expect, it } from 'vitest';
import { checkPlacement } from '../src/construction/placement';
import { createMatch } from '../src/core/createMatch';
import type { BuildingEntity, SimEvent } from '../src/entities/types';
import { asciiSim, openRows, runSeconds } from './helpers';

const RICH = { food: 1000, wood: 1000, gold: 1000, stone: 1000 };

function setup(rows = openRows(30, 20)) {
  const sim = asciiSim(rows);
  const world = sim.world;
  const player = world.getPlayer(1)!;
  player.resources = { ...RICH };
  const tc = world.addBuilding('townCenter', 1, 2, 2);
  const villager = world.addUnit('villager', 1, 8.5, 4.5);
  return { sim, world, player, tc, villager };
}

function place(sim: ReturnType<typeof setup>['sim'], unitIds: number[], buildingType: string, tileX: number, tileY: number, queue = false) {
  return sim.issue(1, { type: 'placeBuilding', unitIds, buildingType, tileX, tileY, queue });
}

function newestBuilding(world: ReturnType<typeof setup>['world']): BuildingEntity {
  return world.buildings[world.buildings.length - 1]!;
}

/** Segundos de simulação até a obra ficar pronta (ou Infinity). */
function timeToComplete(sim: ReturnType<typeof setup>['sim'], building: BuildingEntity, limit = 200): number {
  for (let t = 0; t < limit * 20; t++) {
    sim.step();
    if (building.complete) return (t + 1) / 20;
  }
  return Infinity;
}

describe('Validação de posicionamento', () => {
  it('aceita terreno livre e rejeita fora do mapa, água, sobreposição e unidades inimigas', () => {
    const rows = openRows(30, 20);
    rows[15] = '.'.repeat(10) + '~~~~' + '.'.repeat(16);
    const { world } = setup(rows);
    expect(checkPlacement(world, 1, 'house', 12, 8).ok).toBe(true);
    expect(checkPlacement(world, 1, 'house', 29, 8).ok).toBe(false);
    expect(checkPlacement(world, 1, 'house', -1, 8).ok).toBe(false);
    expect(checkPlacement(world, 1, 'house', 11, 14).ok).toBe(false);
    expect(checkPlacement(world, 1, 'house', 4, 4).ok).toBe(false);
    world.addResource({ type: 'tree', x: 20, y: 8 });
    expect(checkPlacement(world, 1, 'house', 19, 7).invalidTiles.length).toBe(1);
    world.addUnit('villager', 2, 24.5, 4.5);
    expect(checkPlacement(world, 1, 'house', 24, 4).ok).toBe(false);
    world.addUnit('villager', 1, 16.5, 4.5);
    expect(checkPlacement(world, 1, 'house', 16, 4).ok).toBe(true);
  });

  it('rejeita por recursos insuficientes, era e edifícios não construíveis', () => {
    const { world, player } = setup();
    player.resources = { food: 0, wood: 10, gold: 0, stone: 0 };
    const check = checkPlacement(world, 1, 'house', 12, 8);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain('Madeira');
    player.resources = { ...RICH };
    expect(checkPlacement(world, 1, 'townCenter', 12, 8).reason).toContain('Era III');
    expect(checkPlacement(world, 1, 'castleOfNowhere', 12, 8).ok).toBe(false);
  });

  it('o comando valida construtores, inteiros e propriedade', () => {
    const { sim, world, villager } = setup();
    const scout = world.addUnit('scout', 1, 10.5, 10.5);
    const enemy = world.addUnit('villager', 2, 20.5, 15.5);
    expect(place(sim, [scout.id], 'house', 12, 8).ok).toBe(false);
    expect(place(sim, [enemy.id], 'house', 12, 8).ok).toBe(false);
    expect(place(sim, [villager.id], 'house', 12.5, 8).ok).toBe(false);
    expect(place(sim, [villager.id], 'house', 12, 8).ok).toBe(true);
  });
});

describe('Construção', () => {
  it('cobra o custo, cria a fundação bloqueando a grade e constrói até concluir', () => {
    const { sim, world, player, villager } = setup();
    const events: SimEvent[] = [];
    expect(place(sim, [villager.id], 'house', 12, 8).ok).toBe(true);
    sim.step();
    const house = newestBuilding(world);
    expect(house.type).toBe('house');
    expect(house.complete).toBe(false);
    expect(house.hp).toBe(1);
    expect(player.resources.wood).toBe(1000 - 25);
    expect(world.grid.isWalkable(12, 8)).toBe(false);
    const capBefore = player.populationCap;
    runSeconds(sim, 45, () => {
      events.push(...sim.drainEvents());
      expect(world.grid.isWalkableAt(villager.x, villager.y)).toBe(true);
    });
    expect(house.complete).toBe(true);
    expect(house.hp).toBe(house.maxHp);
    expect(player.populationCap).toBe(capBefore + 5);
    expect(events.some((e) => e.type === 'buildingCompleted' && e.id === house.id)).toBe(true);
    expect(villager.task).toBeNull();
    expect(villager.state).toBe('idle');
  });

  it('com um aldeão leva o tempo de construção definido (mais o deslocamento)', () => {
    const { sim, world, villager } = setup();
    place(sim, [villager.id], 'house', 10, 4);
    sim.step();
    const t = timeToComplete(sim, newestBuilding(world));
    expect(t).toBeGreaterThanOrEqual(25);
    expect(t).toBeLessThan(29);
  });

  it('mais construtores aceleram com retorno decrescente: 3T/(N+2)', () => {
    const measure = (n: number) => {
      const { sim, world } = setup();
      const builders = Array.from({ length: n }, (_, i) => world.addUnit('villager', 1, 14.5, 4.5 + i * 0.6));
      place(sim, builders.map((b) => b.id), 'barracks', 12, 8);
      sim.step();
      return timeToComplete(sim, newestBuilding(world));
    };
    const one = measure(1);
    const four = measure(4);
    expect(one).toBeGreaterThan(50);
    expect(four).toBeLessThan(one * 0.62);
    expect(four).toBeGreaterThan(50 * 0.5);
  });

  it('construct envia outro aldeão para ajudar a obra existente', () => {
    const { sim, world, villager } = setup();
    const helper = world.addUnit('villager', 1, 20.5, 12.5);
    place(sim, [villager.id], 'lumberCamp', 12, 8);
    sim.step();
    const camp = newestBuilding(world);
    expect(sim.issue(1, { type: 'construct', unitIds: [helper.id], buildingId: camp.id }).ok).toBe(true);
    runSeconds(sim, 8);
    expect(helper.task?.type).toBe('build');
    expect(helper.state).toBe('building');
  });

  it('cancelar devolve o custo proporcional ao que falta e libera a área', () => {
    const { sim, world, player, villager } = setup();
    place(sim, [villager.id], 'barracks', 12, 8);
    sim.step();
    const barracks = newestBuilding(world);
    runSeconds(sim, 30);
    const progress = barracks.buildProgress;
    expect(progress).toBeGreaterThan(0.2);
    const woodBefore = player.resources.wood;
    expect(sim.issue(1, { type: 'cancelBuilding', buildingId: barracks.id }).ok).toBe(true);
    sim.step();
    expect(world.getEntity(barracks.id)).toBeUndefined();
    expect(world.grid.isWalkable(13, 9)).toBe(true);
    expect(player.resources.wood - woodBefore).toBe(Math.floor(175 * (1 - progress)));
    sim.step();
    expect(villager.task).toBeNull();
  });

  it('não permite cancelar edifício concluído nem obra de outro jogador', () => {
    const { sim, tc, world } = setup();
    expect(sim.issue(1, { type: 'cancelBuilding', buildingId: tc.id }).ok).toBe(false);
    const enemySite = world.addBuilding('house', 2, 20, 12, false);
    expect(sim.issue(1, { type: 'cancelBuilding', buildingId: enemySite.id }).ok).toBe(false);
  });

  it('obra não concluída não recebe recursos; o depósito de madeira concluído passa a receber', () => {
    const { sim, world, villager } = setup(openRows(40, 20));
    for (let y = 6; y <= 10; y++) world.addResource({ type: 'tree', x: 30, y });
    const lumberjack = world.addUnit('villager', 1, 28.5, 8.5);
    place(sim, [villager.id], 'lumberCamp', 27, 3);
    sim.step();
    const camp = newestBuilding(world);
    sim.issue(1, { type: 'gather', unitIds: [lumberjack.id], targetId: world.resources[0]!.id });
    const events: SimEvent[] = [];
    runSeconds(sim, 150, () => events.push(...sim.drainEvents()));
    const deposits = events.filter((e): e is Extract<SimEvent, { type: 'deposited' }> => e.type === 'deposited');
    const completedAt = events.findIndex((e) => e.type === 'buildingCompleted' && e.id === camp.id);
    expect(completedAt).toBeGreaterThan(-1);
    const before = events.slice(0, completedAt).filter((e) => e.type === 'deposited');
    for (const d of before) expect(d.type === 'deposited' && d.dropsiteId).not.toBe(camp.id);
    expect(deposits.some((d) => d.dropsiteId === camp.id)).toBe(true);
  });

  it('quem constrói um depósito de mineração passa a minerar a mina próxima', () => {
    const { sim, world, villager } = setup();
    const gold = world.addResource({ type: 'goldMine', x: 18, y: 10 });
    place(sim, [villager.id], 'miningCamp', 15, 10);
    sim.step();
    runSeconds(sim, 60);
    expect(newestBuilding(world).complete).toBe(true);
    expect(villager.task?.type).toBe('gather');
    expect(villager.task?.type === 'gather' && villager.task.targetId).toBe(gold.id);
  });

  it('Shift: obras em fila são construídas em sequência pelo mesmo aldeão', () => {
    const { sim, world, villager } = setup();
    place(sim, [villager.id], 'house', 12, 4);
    sim.step();
    const first = newestBuilding(world);
    place(sim, [villager.id], 'house', 15, 4, true);
    sim.step();
    const second = newestBuilding(world);
    expect(villager.buildQueue).toEqual([second.id]);
    runSeconds(sim, 80);
    expect(first.complete).toBe(true);
    expect(second.complete).toBe(true);
    expect(villager.buildQueue).toEqual([]);
  });

  it('uma ordem comum (mover) limpa a fila de obras', () => {
    const { sim, world, villager } = setup();
    place(sim, [villager.id], 'house', 12, 4);
    sim.step();
    place(sim, [villager.id], 'house', 15, 4, true);
    sim.step();
    sim.issue(1, { type: 'move', unitIds: [villager.id], target: { x: 20.5, y: 15.5 } });
    sim.step();
    expect(villager.buildQueue).toEqual([]);
    expect(villager.task).toBeNull();
    void world;
  });

  it('afasta as próprias unidades da área e corrige caminhos que atravessam a nova obra', () => {
    const { sim, world, villager } = setup(openRows(30, 12));
    const bystander = world.addUnit('scout', 1, 13.5, 5.5);
    const walker = world.addUnit('villager', 1, 8.5, 6.5);
    sim.issue(1, { type: 'move', unitIds: [walker.id], target: { x: 25.5, y: 6.5 } });
    runSeconds(sim, 1);
    place(sim, [villager.id], 'barracks', 12, 4);
    sim.step();
    expect(world.grid.isWalkableAt(bystander.x, bystander.y)).toBe(true);
    runSeconds(sim, 20, () => {
      for (const u of world.units) expect(world.grid.isWalkableAt(u.x, u.y)).toBe(true);
    });
    expect(Math.hypot(walker.x - 25.5, walker.y - 6.5)).toBeLessThan(0.6);
  });
});

describe('Construção em partida procedural', () => {
  it('aldeões iniciais constroem casa e quartel perto do Centro da Vila', () => {
    const sim = createMatch({ seed: 9, mapSize: 64, players: [{ id: 1, name: 'A', color: 1, isHuman: true }, { id: 2, name: 'B', color: 2, isHuman: false }] });
    const world = sim.world;
    world.getPlayer(1)!.resources.wood = 500;
    const tc = world.buildings.find((b) => b.owner === 1)!;
    const villagers = world.units.filter((u) => u.owner === 1 && u.type === 'villager');
    // Procura posições válidas em anéis ao redor do Centro da Vila.
    const findSpot = (type: string, w: number) => {
      for (let r = 3; r < 12; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const x = tc.tileX + 2 + dx - Math.floor(w / 2);
            const y = tc.tileY + 2 + dy - Math.floor(w / 2);
            if (checkPlacement(world, 1, type, x, y).ok) return { x, y };
          }
        }
      }
      throw new Error('sem espaço');
    };
    const houseSpot = findSpot('house', 2);
    expect(sim.issue(1, { type: 'placeBuilding', unitIds: [villagers[0]!.id], buildingType: 'house', tileX: houseSpot.x, tileY: houseSpot.y }).ok).toBe(true);
    sim.step();
    const barracksSpot = findSpot('barracks', 3);
    expect(sim.issue(1, { type: 'placeBuilding', unitIds: [villagers[1]!.id, villagers[2]!.id], buildingType: 'barracks', tileX: barracksSpot.x, tileY: barracksSpot.y }).ok).toBe(true);
    runSeconds(sim, 90, () => {
      for (const u of world.units) expect(world.grid.isWalkableAt(u.x, u.y)).toBe(true);
    });
    const built = world.buildings.filter((b) => b.owner === 1 && b.complete).map((b) => b.type).sort();
    expect(built).toEqual(['barracks', 'house', 'townCenter']);
    expect(world.getPlayer(1)!.populationCap).toBe(15);
  });
});
