import { describe, expect, it } from 'vitest';
import { checkBuildingAvailability } from '../src/construction/placement';
import type { SimEvent } from '../src/entities/types';
import { asciiSim, openRows, runSeconds } from './helpers';

const RICH = { food: 1000, wood: 1000, gold: 1000, stone: 1000 };

function setup() {
  const sim = asciiSim(openRows(40, 24));
  const world = sim.world;
  const player = world.getPlayer(1)!;
  player.resources = { ...RICH };
  const tc = world.addBuilding('townCenter', 1, 4, 4);
  const barracks = world.addBuilding('barracks', 1, 14, 4);
  return { sim, world, player, tc, barracks };
}

describe('Treinamento', () => {
  it('cobra ao enfileirar e cria a unidade ao lado do edifício após o tempo de treino', () => {
    const { sim, world, player, tc } = setup();
    expect(sim.issue(1, { type: 'train', buildingId: tc.id, unitType: 'villager' }).ok).toBe(true);
    sim.step();
    expect(player.resources.food).toBe(950);
    expect(tc.queue).toHaveLength(1);
    const events: SimEvent[] = [];
    runSeconds(sim, 24, () => events.push(...sim.drainEvents()));
    expect(world.units).toHaveLength(0);
    runSeconds(sim, 1.2, () => events.push(...sim.drainEvents()));
    expect(world.units).toHaveLength(1);
    const v = world.units[0]!;
    expect(v.type).toBe('villager');
    expect(Math.max(Math.abs(v.x - tc.x) - 2, Math.abs(v.y - tc.y) - 2)).toBeLessThan(1.1);
    expect(world.grid.isWalkableAt(v.x, v.y)).toBe(true);
    expect(player.population).toBe(1);
    expect(player.stats.unitsTrained).toBe(1);
    expect(events.some((e) => e.type === 'unitTrained' && e.buildingId === tc.id)).toBe(true);
  });

  it('a fila é processada em sequência', () => {
    const { sim, world, barracks } = setup();
    sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'swordsman' });
    sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'spearman' });
    runSeconds(sim, 22);
    expect(world.units.map((u) => u.type)).toEqual(['swordsman']);
    runSeconds(sim, 22);
    expect(world.units.map((u) => u.type)).toEqual(['swordsman', 'spearman']);
  });

  it('bloqueia por população, avisa uma vez e retoma ao construir casa', () => {
    const { sim, world, player, tc } = setup();
    player.populationCap = 1;
    world.addUnit('villager', 1, 20.5, 20.5);
    sim.issue(1, { type: 'train', buildingId: tc.id, unitType: 'villager' });
    const events: SimEvent[] = [];
    runSeconds(sim, 40, () => events.push(...sim.drainEvents()));
    expect(events.filter((e) => e.type === 'trainingBlocked')).toHaveLength(1);
    expect(tc.queue[0]!.progress).toBe(0);
    world.addBuilding('house', 1, 30, 18);
    runSeconds(sim, 26);
    expect(world.units.filter((u) => u.type === 'villager')).toHaveLength(2);
  });

  it('cancelar devolve o custo integral', () => {
    const { sim, player, barracks } = setup();
    sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'swordsman' });
    sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'swordsman' });
    runSeconds(sim, 5);
    expect(player.resources.food).toBe(1000 - 120);
    expect(sim.issue(1, { type: 'cancelTrain', buildingId: barracks.id, index: 1 }).ok).toBe(true);
    sim.step();
    expect(barracks.queue).toHaveLength(1);
    expect(player.resources.food).toBe(1000 - 60);
    expect(player.resources.gold).toBe(1000 - 20);
  });

  it('valida edifício, unidade, recursos, obra e fila cheia', () => {
    const { sim, world, player, tc, barracks } = setup();
    expect(sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'villager' }).ok).toBe(false);
    expect(sim.issue(1, { type: 'train', buildingId: tc.id, unitType: 'archer' }).ok).toBe(false);
    const enemyTc = world.addBuilding('townCenter', 2, 30, 4);
    expect(sim.issue(1, { type: 'train', buildingId: enemyTc.id, unitType: 'villager' }).ok).toBe(false);
    const site = world.addBuilding('barracks', 1, 4, 14, false);
    expect(sim.issue(1, { type: 'train', buildingId: site.id, unitType: 'swordsman' }).ok).toBe(false);
    for (let i = 0; i < 10; i++) expect(sim.issue(1, { type: 'train', buildingId: tc.id, unitType: 'villager' }).ok).toBe(true);
    sim.step();
    expect(sim.issue(1, { type: 'train', buildingId: tc.id, unitType: 'villager' }).ok).toBe(false);
    player.resources.gold = 0;
    expect(sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'swordsman' })).toMatchObject({ ok: false, reason: expect.stringContaining('Ouro') });
  });

  it('ponto de reunião em recurso: o aldeão treinado começa a coletar', () => {
    const { sim, world, tc } = setup();
    const tree = world.addResource({ type: 'tree', x: 4, y: 14 });
    expect(sim.issue(1, { type: 'setRallyPoint', buildingId: tc.id, target: { x: 4.5, y: 14.5 }, targetId: tree.id }).ok).toBe(true);
    sim.issue(1, { type: 'train', buildingId: tc.id, unitType: 'villager' });
    runSeconds(sim, 40);
    const v = world.units[0]!;
    expect(v.task?.type).toBe('gather');
    expect(tree.amount).toBeLessThan(100);
  });

  it('ponto de reunião no terreno: a unidade vai até lá', () => {
    const { sim, world, barracks } = setup();
    sim.issue(1, { type: 'setRallyPoint', buildingId: barracks.id, target: { x: 30.5, y: 18.5 } });
    sim.issue(1, { type: 'train', buildingId: barracks.id, unitType: 'spearman' });
    runSeconds(sim, 35);
    const u = world.units[0]!;
    expect(Math.hypot(u.x - 30.5, u.y - 18.5)).toBeLessThan(0.6);
  });

  it('o Campo de Arqueiros exige um Quartel concluído', () => {
    const sim = asciiSim(openRows(30, 20));
    const world = sim.world;
    world.getPlayer(1)!.resources = { ...RICH };
    expect(checkBuildingAvailability(world, 1, 'archeryRange')).toMatchObject({ ok: false, reason: expect.stringContaining('Quartel') });
    world.addBuilding('barracks', 1, 2, 2, false);
    expect(checkBuildingAvailability(world, 1, 'archeryRange').ok).toBe(false);
    world.completeBuilding(world.buildings[0]!);
    expect(checkBuildingAvailability(world, 1, 'archeryRange').ok).toBe(true);
  });
});

describe('Reparo', () => {
  it('restaura a vida cobrando parte do custo; para quando os recursos acabam', () => {
    const { sim, world, player } = setup();
    const house = world.addBuilding('house', 1, 24, 14);
    house.hp = 150;
    const v = world.addUnit('villager', 1, 22.5, 14.5);
    expect(sim.issue(1, { type: 'repair', unitIds: [v.id], buildingId: house.id }).ok).toBe(true);
    const events: SimEvent[] = [];
    runSeconds(sim, 120, () => events.push(...sim.drainEvents()));
    expect(house.hp).toBe(house.maxHp);
    // 400/550 da vida × 50% de 25 madeira ≈ 9 madeira (arredondado para baixo nas cobranças).
    expect(1000 - player.resources.wood).toBeGreaterThanOrEqual(8);
    expect(1000 - player.resources.wood).toBeLessThanOrEqual(10);
    expect(events.some((e) => e.type === 'repairStopped' && e.reason === 'done')).toBe(true);
    expect(v.task).toBeNull();

    house.hp = 100;
    player.resources.wood = 2;
    sim.issue(1, { type: 'repair', unitIds: [v.id], buildingId: house.id });
    runSeconds(sim, 120, () => events.push(...sim.drainEvents()));
    expect(house.hp).toBeLessThan(house.maxHp);
    expect(player.resources.wood).toBeGreaterThanOrEqual(0);
    expect(events.some((e) => e.type === 'repairStopped' && e.reason === 'resources')).toBe(true);
  });

  it('não repara obra, edifício intacto ou de outro jogador', () => {
    const { sim, world, tc } = setup();
    const v = world.addUnit('villager', 1, 22.5, 14.5);
    expect(sim.issue(1, { type: 'repair', unitIds: [v.id], buildingId: tc.id }).ok).toBe(false);
    const site = world.addBuilding('house', 1, 30, 14, false);
    expect(sim.issue(1, { type: 'repair', unitIds: [v.id], buildingId: site.id }).ok).toBe(false);
    const enemy = world.addBuilding('house', 2, 34, 18);
    enemy.hp = 10;
    expect(sim.issue(1, { type: 'repair', unitIds: [v.id], buildingId: enemy.id }).ok).toBe(false);
  });
});

describe('Critério da Fase 4: duas facções produzem unidades e combatem', () => {
  it('cada jogador treina um exército e as unidades lutam até um lado ser derrotado', () => {
    const sim = asciiSim(openRows(48, 24));
    const world = sim.world;
    for (const id of [1, 2]) world.getPlayer(id)!.resources = { ...RICH };
    world.getPlayer(1)!.populationCap = world.getPlayer(2)!.populationCap = 50;
    const b1 = world.addBuilding('barracks', 1, 3, 10);
    const r1 = world.addBuilding('archeryRange', 1, 3, 15);
    const b2 = world.addBuilding('barracks', 2, 42, 10);
    for (let i = 0; i < 3; i++) {
      sim.issue(1, { type: 'train', buildingId: b1.id, unitType: 'swordsman' });
      sim.issue(2, { type: 'train', buildingId: b2.id, unitType: i === 0 ? 'swordsman' : 'spearman' });
    }
    sim.issue(1, { type: 'train', buildingId: r1.id, unitType: 'archer' });
    runSeconds(sim, 75);
    const army = (owner: number) => world.units.filter((u) => u.owner === owner).map((u) => u.id);
    expect(army(1)).toHaveLength(4);
    expect(army(2)).toHaveLength(3);
    sim.issue(1, { type: 'attackMove', unitIds: army(1), target: { x: 40.5, y: 12.5 } });
    sim.issue(2, { type: 'attackMove', unitIds: army(2), target: { x: 8.5, y: 12.5 } });
    const events: SimEvent[] = [];
    runSeconds(sim, 120, () => events.push(...sim.drainEvents()));
    const deaths = events.filter((e) => e.type === 'entityDied' && e.kind === 'unit');
    expect(deaths.length).toBeGreaterThanOrEqual(3);
    expect(army(1).length === 0 || army(2).length === 0).toBe(true);
  });
});
