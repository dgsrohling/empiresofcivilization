import { describe, expect, it } from 'vitest';
import { createMatch } from '../src/core/createMatch';
import type { Simulation } from '../src/core/Simulation';
import type { ResourceEntity, SimEvent, UnitEntity } from '../src/entities/types';
import { asciiSim, openRows, runSeconds } from './helpers';

/** Mapa 24×16 com Centro da Vila do jogador 1 em (2,2) e um aldeão em (8.5, 4.5). */
function setup(rows = openRows(24, 16)) {
  const sim = asciiSim(rows);
  const world = sim.world;
  const tc = world.addBuilding('townCenter', 1, 2, 2);
  const villager = world.addUnit('villager', 1, 8.5, 4.5);
  return { sim, world, tc, villager };
}

function gather(sim: Simulation, unit: UnitEntity, target: ResourceEntity) {
  const r = sim.issue(1, { type: 'gather', unitIds: [unit.id], targetId: target.id });
  expect(r).toEqual({ ok: true });
}

function collectEvents(sim: Simulation, seconds: number, onTick?: () => void): SimEvent[] {
  const events: SimEvent[] = [];
  runSeconds(sim, seconds, () => {
    events.push(...sim.drainEvents());
    onTick?.();
  });
  return events;
}

describe('Coleta e depósito', () => {
  it('completa o ciclo coleta → depósito → retorno, conservando o recurso', () => {
    const { sim, world, villager } = setup();
    const tree = world.addResource({ type: 'tree', x: 14, y: 4 });
    const player = world.getPlayer(1)!;
    gather(sim, villager, tree);
    let maxCarry = 0;
    const events = collectEvents(sim, 120, () => {
      expect(tree.amount + villager.carryAmount + player.resources.wood).toBe(100);
      maxCarry = Math.max(maxCarry, villager.carryAmount);
      expect(world.grid.isWalkableAt(villager.x, villager.y)).toBe(true);
    });
    const deposits = events.filter((e) => e.type === 'deposited');
    expect(deposits.length).toBeGreaterThanOrEqual(2);
    for (const d of deposits) expect(d.type === 'deposited' && d.amount).toBe(10);
    expect(player.resources.wood % 10).toBe(0);
    expect(player.stats.gathered.wood).toBe(player.resources.wood);
    expect(maxCarry).toBe(10);
    expect(villager.task?.targetId).toBe(tree.id);
  });

  it('deposita no depósito aceito mais próximo', () => {
    const { sim, world, villager, tc } = setup(openRows(40, 16));
    const farTc = world.addBuilding('townCenter', 1, 30, 2);
    const tree = world.addResource({ type: 'tree', x: 27, y: 4 });
    villager.x = 24.5;
    gather(sim, villager, tree);
    const events = collectEvents(sim, 40);
    const deposit = events.find((e) => e.type === 'deposited');
    expect(deposit && deposit.type === 'deposited' && deposit.dropsiteId).toBe(farTc.id);
    expect(deposit && deposit.type === 'deposited' && deposit.dropsiteId).not.toBe(tc.id);
  });

  it('remove a fonte esgotada, libera o tile e passa para outra do mesmo tipo', () => {
    const { sim, world, villager } = setup();
    const first = world.addResource({ type: 'tree', x: 14, y: 4 });
    const second = world.addResource({ type: 'tree', x: 15, y: 5 });
    first.amount = 4;
    gather(sim, villager, first);
    const events = collectEvents(sim, 40);
    expect(world.getEntity(first.id)).toBeUndefined();
    expect(world.grid.isWalkable(14, 4)).toBe(true);
    expect(world.getStaticAtTile(14, 4)).toBeUndefined();
    expect(events.some((e) => e.type === 'entityRemoved' && e.id === first.id)).toBe(true);
    expect(villager.task?.targetId).toBe(second.id);
    expect(second.amount).toBeLessThan(100);
  });

  it('sem fontes por perto, deposita o que carrega e fica ocioso', () => {
    const { sim, world, villager } = setup();
    const bush = world.addResource({ type: 'berryBush', x: 14, y: 4 });
    bush.amount = 6;
    const player = world.getPlayer(1)!;
    gather(sim, villager, bush);
    runSeconds(sim, 60);
    expect(player.resources.food).toBe(6);
    expect(villager.carryAmount).toBe(0);
    expect(villager.task).toBeNull();
    expect(villager.state).toBe('idle');
  });

  it('sem depósito, para com a carga e emite aviso', () => {
    const sim = asciiSim(openRows(20, 10));
    const world = sim.world;
    const villager = world.addUnit('villager', 1, 5.5, 5.5);
    const tree = world.addResource({ type: 'tree', x: 8, y: 5 });
    gather(sim, villager, tree);
    const events = collectEvents(sim, 40);
    expect(villager.carryAmount).toBe(10);
    expect(villager.state).toBe('idle');
    expect(events.some((e) => e.type === 'noDropsite' && e.unitId === villager.id)).toBe(true);
  });

  it('trocar de tipo de recurso descarta a carga atual', () => {
    const { sim, world, villager } = setup();
    const gold = world.addResource({ type: 'goldMine', x: 14, y: 8 });
    villager.carryType = 'wood';
    villager.carryAmount = 6;
    gather(sim, villager, gold);
    sim.step();
    expect(villager.carryAmount).toBe(0);
    expect(villager.carryType).toBeNull();
  });

  it('comando de depósito entrega a carga e deixa o aldeão ocioso', () => {
    const { sim, world, villager, tc } = setup();
    const player = world.getPlayer(1)!;
    villager.carryType = 'stone';
    villager.carryAmount = 7;
    expect(sim.issue(1, { type: 'deposit', unitIds: [villager.id], dropsiteId: tc.id }).ok).toBe(true);
    runSeconds(sim, 10);
    expect(player.resources.stone).toBe(7);
    expect(villager.carryAmount).toBe(0);
    expect(villager.state).toBe('idle');
  });

  it('redireciona para uma árvore acessível quando a escolhida está cercada', () => {
    const { sim, world, villager } = setup();
    const trees: ResourceEntity[] = [];
    for (let y = 3; y <= 7; y++) for (let x = 13; x <= 17; x++) trees.push(world.addResource({ type: 'tree', x, y }));
    const inner = trees.find((t) => t.tileX === 15 && t.tileY === 5)!;
    gather(sim, villager, inner);
    runSeconds(sim, 30);
    const target = world.getEntity(villager.task!.targetId!) as ResourceEntity;
    expect(target.id).not.toBe(inner.id);
    expect(target.tileX === 13 || target.tileX === 17 || target.tileY === 3 || target.tileY === 7).toBe(true);
    expect(villager.carryAmount + world.getPlayer(1)!.resources.wood).toBeGreaterThan(0);
  });

  it('vários aldeões coletam da mesma fonte sem violar conservação nem obstáculos', () => {
    const { sim, world } = setup();
    const bush = world.addResource({ type: 'berryBush', x: 14, y: 6 });
    const villagers = [0, 1, 2, 3].map((i) => world.addUnit('villager', 1, 8.5, 3.5 + i));
    const player = world.getPlayer(1)!;
    sim.issue(1, { type: 'gather', unitIds: villagers.map((v) => v.id), targetId: bush.id });
    runSeconds(sim, 90, () => {
      const carried = villagers.reduce((s, v) => s + v.carryAmount, 0);
      expect((world.getEntity(bush.id) ? bush.amount : 0) + carried + player.resources.food).toBe(125);
      for (const v of villagers) expect(world.grid.isWalkableAt(v.x, v.y)).toBe(true);
    });
    expect(villagers.every((v) => v.carryAmount > 0 || player.resources.food > 0)).toBe(true);
    expect(villagers.filter((v) => v.state === 'gathering').length).toBeGreaterThanOrEqual(2);
  });

  it('modificadores do jogador alteram velocidade e capacidade de carga', () => {
    const run = (rate: number, capacityBonus: number) => {
      const { sim, world, villager } = setup();
      const player = world.getPlayer(1)!;
      player.modifiers.gatherRate.gold = rate;
      player.modifiers.carryCapacity = capacityBonus;
      const gold = world.addResource({ type: 'goldMine', x: 14, y: 4 });
      gather(sim, villager, gold);
      const events = collectEvents(sim, 60);
      return { gold: player.resources.gold, first: events.find((e) => e.type === 'deposited') };
    };
    const base = run(1, 0);
    const fast = run(2, 5);
    expect(fast.gold).toBeGreaterThan(base.gold);
    expect(fast.first && fast.first.type === 'deposited' && fast.first.amount).toBe(15);
  });

  it('ordem de movimento cancela a coleta', () => {
    const { sim, world, villager } = setup();
    const tree = world.addResource({ type: 'tree', x: 14, y: 4 });
    gather(sim, villager, tree);
    runSeconds(sim, 15);
    expect(villager.state).toBe('gathering');
    sim.issue(1, { type: 'move', unitIds: [villager.id], target: { x: 10.5, y: 12.5 } });
    runSeconds(sim, 10);
    expect(villager.task).toBeNull();
    expect(villager.state).toBe('idle');
    expect(Math.hypot(villager.x - 10.5, villager.y - 12.5)).toBeLessThan(0.5);
  });
});

describe('Validação de comandos econômicos', () => {
  it('rejeita coleta por unidades que não são aldeões', () => {
    const { sim, world } = setup();
    const scout = world.addUnit('scout', 1, 10.5, 10.5);
    const tree = world.addResource({ type: 'tree', x: 14, y: 4 });
    expect(sim.issue(1, { type: 'gather', unitIds: [scout.id], targetId: tree.id }).ok).toBe(false);
  });

  it('rejeita alvo que não é recurso e aldeões de outro jogador', () => {
    const { sim, world, villager, tc } = setup();
    const enemy = world.addUnit('villager', 2, 12.5, 12.5);
    const tree = world.addResource({ type: 'tree', x: 14, y: 4 });
    expect(sim.issue(1, { type: 'gather', unitIds: [villager.id], targetId: tc.id }).ok).toBe(false);
    expect(sim.issue(1, { type: 'gather', unitIds: [enemy.id], targetId: tree.id }).ok).toBe(false);
  });

  it('rejeita depósito em edifício inimigo', () => {
    const { sim, world, villager } = setup(openRows(30, 16));
    const enemyTc = world.addBuilding('townCenter', 2, 20, 2);
    expect(sim.issue(1, { type: 'deposit', unitIds: [villager.id], dropsiteId: enemyTc.id }).ok).toBe(false);
  });
});

describe('Economia em partida procedural', () => {
  const PLAYERS = [
    { id: 1, name: 'Jogador', color: 1, isHuman: true },
    { id: 2, name: 'Rival', color: 2, isHuman: false },
  ];

  function runEconomy(seed: number) {
    const sim = createMatch({ seed, mapSize: 64, players: PLAYERS });
    const world = sim.world;
    const tc = world.buildings.find((b) => b.owner === 1)!;
    const villagers = world.units.filter((u) => u.owner === 1 && u.type === 'villager');
    const nearest = (type: string) =>
      world.resources.filter((r) => r.nodeType === type).sort((a, b) => Math.hypot(a.x - tc.x, a.y - tc.y) - Math.hypot(b.x - tc.x, b.y - tc.y))[0]!;
    const assignments: Array<[number, ResourceEntity]> = [
      [0, nearest('berryBush')],
      [1, nearest('tree')],
      [2, nearest('tree')],
      [3, nearest('goldMine')],
      [4, nearest('stoneMine')],
    ];
    for (const [i, target] of assignments) expect(sim.issue(1, { type: 'gather', unitIds: [villagers[i]!.id], targetId: target.id }).ok).toBe(true);
    runSeconds(sim, 180, () => {
      for (const v of villagers) expect(world.grid.isWalkableAt(v.x, v.y)).toBe(true);
    });
    return { sim, player: world.getPlayer(1)! };
  }

  it('aldeões iniciais aumentam os quatro recursos em 3 minutos', () => {
    const { player } = runEconomy(11);
    expect(player.stats.gathered.food).toBeGreaterThan(0);
    expect(player.stats.gathered.wood).toBeGreaterThan(0);
    expect(player.stats.gathered.gold).toBeGreaterThan(0);
    expect(player.stats.gathered.stone).toBeGreaterThan(0);
    expect(player.resources.wood).toBe(200 + player.stats.gathered.wood);
  });

  it('é determinística com coleta', () => {
    const a = runEconomy(5);
    const b = runEconomy(5);
    expect(a.player.resources).toEqual(b.player.resources);
    expect(a.sim.world.units.map((u) => [u.x, u.y])).toEqual(b.sim.world.units.map((u) => [u.x, u.y]));
  });
});
