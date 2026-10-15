import { getUnitDefinition } from '@eoc/game-data';
import { describe, expect, it } from 'vitest';
import { computeDamage } from '../src/combat/damage';
import type { SimEvent, UnitEntity } from '../src/entities/types';
import { asciiSim, openRows, runSeconds } from './helpers';

function arena(width = 30, height = 16) {
  const sim = asciiSim(openRows(width, height));
  return { sim, world: sim.world };
}

function until(sim: ReturnType<typeof arena>['sim'], cond: () => boolean, maxSeconds: number): number {
  for (let t = 0; t < maxSeconds * 20; t++) {
    if (cond()) return t / 20;
    sim.step();
  }
  return Infinity;
}

describe('Fórmula de dano', () => {
  const { world } = arena();
  const unit = (type: string) => world.addUnit(type, 2, 20.5, 8.5);
  it('ataque − armadura + bônus, mínimo 1', () => {
    expect(computeDamage(getUnitDefinition('swordsman'), unit('villager'))).toBe(7);
    expect(computeDamage(getUnitDefinition('archer'), unit('swordsman'))).toBe(4); // 4 − 1 + 1 (bônus vs infantaria)
    expect(computeDamage(getUnitDefinition('spearman'), unit('scout'))).toBe(18); // 3 + 15 vs cavalaria
    expect(computeDamage(getUnitDefinition('scout'), unit('archer'))).toBe(6); // 3 + 3 vs arqueiro
    const house = world.addBuilding('house', 2, 2, 2);
    expect(computeDamage(getUnitDefinition('archer'), house)).toBe(1); // 4 − 7 → mínimo 1
    expect(computeDamage(getUnitDefinition('swordsman'), house)).toBe(10); // 7 − 0 + 3 vs edifício
  });
});

describe('Combate entre unidades', () => {
  it('ataque explícito corpo a corpo mata o alvo, remove a unidade e registra estatísticas', () => {
    const { sim, world } = arena();
    const sword = world.addUnit('swordsman', 1, 5.5, 8.5);
    const enemy = world.addUnit('villager', 2, 9.5, 8.5);
    world.getPlayer(2)!.populationCap = 10;
    const popBefore = world.getPlayer(2)!.population;
    expect(sim.issue(1, { type: 'attack', unitIds: [sword.id], targetId: enemy.id }).ok).toBe(true);
    const events: SimEvent[] = [];
    const t = until(sim, () => (events.push(...sim.drainEvents()), !world.getEntity(enemy.id)), 30);
    expect(t).toBeLessThan(15);
    expect(events.some((e) => e.type === 'entityDied' && e.id === enemy.id && e.killerOwner === 1)).toBe(true);
    expect(events.filter((e) => e.type === 'meleeHit').length).toBe(Math.ceil(25 / 7));
    expect(world.getPlayer(2)!.population).toBe(popBefore - 1);
    expect(world.getPlayer(2)!.stats.unitsLost).toBe(1);
    expect(world.getPlayer(1)!.stats.kills).toBe(1);
    sim.step();
    expect(sword.task).toBeNull();
  });

  it('lanceiro vence o batedor (bônus contra cavalaria)', () => {
    const { sim, world } = arena();
    const spear = world.addUnit('spearman', 1, 5.5, 8.5);
    const scout = world.addUnit('scout', 2, 7.5, 8.5);
    sim.issue(1, { type: 'attack', unitIds: [spear.id], targetId: scout.id });
    runSeconds(sim, 20);
    expect(world.getEntity(scout.id)).toBeUndefined();
    expect(world.getEntity(spear.id)).toBeDefined();
  });

  it('arqueiro dispara projéteis que levam tempo para chegar e não se aproxima quando já está no alcance', () => {
    const { sim, world } = arena();
    const archer = world.addUnit('archer', 1, 5.5, 8.5);
    const target = world.addUnit('villager', 2, 9.5, 8.5);
    sim.issue(1, { type: 'attack', unitIds: [archer.id], targetId: target.id });
    sim.step();
    sim.step();
    expect(world.projectiles.length).toBe(1);
    expect(target.hp).toBe(25);
    const hpAfter = until(sim, () => target.hp < 25, 3);
    expect(hpAfter).toBeGreaterThan(0.3);
    expect(target.hp).toBe(25 - 4);
    expect(Math.hypot(archer.x - 5.5, archer.y - 8.5)).toBeLessThan(0.05);
  });

  it('unidade militar parada ataca sozinha o inimigo que entra no campo de visão', () => {
    const { sim, world } = arena();
    const guard = world.addUnit('swordsman', 1, 5.5, 8.5);
    const intruder = world.addUnit('villager', 2, 20.5, 8.5);
    sim.issue(2, { type: 'move', unitIds: [intruder.id], target: { x: 8.5, y: 8.5 } });
    runSeconds(sim, 25);
    expect(world.getEntity(intruder.id)).toBeUndefined();
    expect(guard.state).not.toBe('moving');
  });

  it('movimento comum ignora inimigos; ataque-mover enfrenta e depois segue até o destino', () => {
    const run = (type: 'move' | 'attackMove') => {
      const { sim, world } = arena(40, 16);
      const unit = world.addUnit('swordsman', 1, 3.5, 8.5);
      const enemy = world.addUnit('villager', 2, 18.5, 9.5);
      enemy.stance = 'holdPosition';
      sim.issue(1, { type, unitIds: [unit.id], target: { x: 35.5, y: 8.5 } });
      runSeconds(sim, 50);
      return { enemyAlive: !!world.getEntity(enemy.id), unit };
    };
    const plain = run('move');
    expect(plain.enemyAlive).toBe(true);
    expect(Math.hypot(plain.unit.x - 35.5, plain.unit.y - 8.5)).toBeLessThan(0.6);
    const attackMove = run('attackMove');
    expect(attackMove.enemyAlive).toBe(false);
    expect(Math.hypot(attackMove.unit.x - 35.5, attackMove.unit.y - 8.5)).toBeLessThan(0.6);
  });

  it('manter posição: não persegue, só ataca o que está ao alcance', () => {
    const { sim, world } = arena();
    const archer = world.addUnit('archer', 1, 5.5, 8.5);
    sim.issue(1, { type: 'setStance', unitIds: [archer.id], stance: 'holdPosition' });
    const far = world.addUnit('villager', 2, 11.5, 8.5); // dentro da visão, fora do alcance
    runSeconds(sim, 5);
    expect(far.hp).toBe(25);
    expect(Math.hypot(archer.x - 5.5, archer.y - 8.5)).toBeLessThan(0.05);
    const near = world.addUnit('villager', 2, 8.5, 8.5);
    runSeconds(sim, 5);
    expect(near.hp).toBeLessThan(25);
    expect(Math.hypot(archer.x - 5.5, archer.y - 8.5)).toBeLessThan(0.3);
  });

  it('postura defensiva: persegue pouco e volta ao ponto de guarda', () => {
    const { sim, world } = arena(50, 16);
    const def = world.addUnit('swordsman', 1, 10.5, 8.5);
    sim.issue(1, { type: 'setStance', unitIds: [def.id], stance: 'defensive' });
    sim.step();
    const scout = world.addUnit('scout', 2, 14.5, 8.5);
    runSeconds(sim, 1);
    expect(def.task?.type).toBe('attack');
    // O batedor foge para longe; o espadachim não deve segui-lo indefinidamente.
    sim.issue(2, { type: 'move', unitIds: [scout.id], target: { x: 48.5, y: 8.5 } });
    runSeconds(sim, 25);
    expect(Math.hypot(def.x - 10.5, def.y - 8.5)).toBeLessThan(1.5);
    expect(def.task).toBeNull();
  });

  it('unidade militar revida quando atacada', () => {
    const { sim, world } = arena();
    const sword = world.addUnit('swordsman', 1, 5.5, 8.5);
    sim.issue(1, { type: 'setStance', unitIds: [sword.id], stance: 'defensive' });
    const archer = world.addUnit('archer', 2, 10.5, 8.5);
    archer.stance = 'holdPosition';
    sim.issue(2, { type: 'attack', unitIds: [archer.id], targetId: sword.id });
    runSeconds(sim, 30);
    expect(world.getEntity(archer.id)).toBeUndefined();
  });

  it('destruir edifício remove-o, libera a área e reduz o limite populacional', () => {
    const { sim, world } = arena();
    const house = world.addBuilding('house', 2, 12, 7);
    const capBefore = world.getPlayer(2)!.populationCap;
    const swords = [0, 1, 2].map((i) => world.addUnit('swordsman', 1, 8.5, 7.5 + i));
    sim.issue(1, { type: 'attack', unitIds: swords.map((s) => s.id), targetId: house.id });
    const events: SimEvent[] = [];
    runSeconds(sim, 60, () => events.push(...sim.drainEvents()));
    expect(world.getEntity(house.id)).toBeUndefined();
    expect(world.grid.isWalkable(12, 7)).toBe(true);
    expect(world.getPlayer(2)!.populationCap).toBe(capBefore - 5);
    expect(events.some((e) => e.type === 'entityDied' && e.kind === 'building')).toBe(true);
    expect(world.getPlayer(2)!.stats.buildingsLost).toBe(1);
  });

  it('valida ordens de ataque', () => {
    const { sim, world } = arena();
    const sword = world.addUnit('swordsman', 1, 5.5, 8.5);
    const friend = world.addUnit('villager', 1, 6.5, 8.5);
    const enemy = world.addUnit('villager', 2, 9.5, 8.5);
    const tree = world.addResource({ type: 'tree', x: 15, y: 3 });
    expect(sim.issue(1, { type: 'attack', unitIds: [sword.id], targetId: friend.id }).ok).toBe(false);
    expect(sim.issue(1, { type: 'attack', unitIds: [sword.id], targetId: tree.id }).ok).toBe(false);
    expect(sim.issue(1, { type: 'attack', unitIds: [enemy.id], targetId: sword.id }).ok).toBe(false);
    expect(sim.issue(1, { type: 'attack', unitIds: [friend.id], targetId: enemy.id }).ok).toBe(true);
    expect(sim.issue(1, { type: 'setStance', unitIds: [sword.id], stance: 'berserk' as never }).ok).toBe(false);
  });

  it('nenhuma unidade fica em tile bloqueado durante uma batalha e o resultado é determinístico', () => {
    const battle = () => {
      const { sim, world } = arena(40, 20);
      for (let i = 0; i < 6; i++) world.addUnit(i % 2 ? 'swordsman' : 'archer', 1, 4.5, 6.5 + i);
      for (let i = 0; i < 6; i++) world.addUnit(i % 2 ? 'spearman' : 'swordsman', 2, 35.5, 6.5 + i);
      const ids = (owner: number) => world.units.filter((u) => u.owner === owner).map((u) => u.id);
      sim.issue(1, { type: 'attackMove', unitIds: ids(1), target: { x: 35.5, y: 9.5 } });
      sim.issue(2, { type: 'attackMove', unitIds: ids(2), target: { x: 4.5, y: 9.5 } });
      runSeconds(sim, 90, () => {
        for (const u of world.units) expect(world.grid.isWalkableAt(u.x, u.y)).toBe(true);
      });
      return world.units.map((u: UnitEntity) => [u.id, u.owner, u.hp, u.x.toFixed(4), u.y.toFixed(4)]);
    };
    const a = battle();
    expect(new Set(a.map((u) => u[1])).size).toBe(1); // um dos lados foi eliminado
    expect(a).toEqual(battle());
  });
});
