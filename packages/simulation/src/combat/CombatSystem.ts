import { COMBAT, getUnitDefinition, type UnitDefinition } from '@eoc/game-data';
import type { EntityId, PlayerId, Vec2 } from '@eoc/shared';
import { areEnemies } from '../core/players';
import type { World } from '../core/World';
import { findApproachPoint, rectOf } from '../economy/queries';
import type { AttackTask, UnitEntity } from '../entities/types';
import type { MovementSystem } from '../movement/MovementSystem';
import { SpatialHash } from '../spatial/SpatialHash';
import { computeDamage, edgeDistance, isCombatTarget, type CombatTarget } from './damage';

/** Alcance mínimo efetivo de unidades corpo a corpo (tiles entre bordas). */
const MELEE_REACH = 0.2;
const PROJECTILE_HIT_RADIUS = 0.25;

/**
 * Combate: perseguição e ataque (corpo a corpo instantâneo, à distância com projétil),
 * busca automática de alvos conforme a postura, ataque-mover, revide e mortes.
 *
 * Mortes são processadas no fim do tick para não alterar listas durante a iteração.
 */
export class CombatSystem {
  private readonly hash: SpatialHash;
  private hashed: UnitEntity[] = [];
  private readonly nearby: number[] = [];
  private readonly dying = new Map<EntityId, PlayerId | null>();

  constructor(
    private readonly world: World,
    private readonly movement: MovementSystem,
  ) {
    this.hash = new SpatialHash(world.width, world.height, 4);
  }

  /** Ordem explícita de ataque. */
  startAttack(unit: UnitEntity, target: CombatTarget, auto = false): void {
    if (getUnitDefinition(unit.type).attack <= 0) return;
    if (!auto) unit.attackMoveGoal = null;
    unit.task = { type: 'attack', targetId: target.id, auto, repathTimer: 0 };
    unit.state = 'moving';
  }

  /** Ataque-mover: segue até o ponto, enfrentando inimigos encontrados pelo caminho. */
  startAttackMove(unit: UnitEntity, goal: Vec2): void {
    unit.task = null;
    unit.attackMoveGoal = { x: goal.x, y: goal.y };
    unit.state = 'moving';
    unit.scanTimer = 0;
    this.movement.moveUnit(unit, goal);
  }

  update(dt: number): void {
    const world = this.world;
    this.hashed = world.units.slice();
    this.hash.clear();
    for (const u of this.hashed) this.hash.insert(u.x, u.y);

    for (const unit of this.hashed) {
      if (unit.attackCooldown > 0) unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
      if (unit.task?.type === 'attack') this.updateAttacker(unit, unit.task, dt);
      else this.updateIdleCombatant(unit, dt);
    }
    this.updateProjectiles(dt);
    this.flushDeaths();
  }

  // ------------------------------------------------------------------ ataque

  private updateAttacker(unit: UnitEntity, task: AttackTask, dt: number): void {
    const target = this.world.getEntity(task.targetId);
    if (!isCombatTarget(target) || !areEnemies(unit.owner, target.owner) || this.dying.has(target.id)) return this.endAttack(unit, task);
    const def = getUnitDefinition(unit.type);

    if (task.auto) {
      const leash = COMBAT.leash[unit.stance];
      const fromGuard = Math.hypot(unit.x - unit.guardX, unit.y - unit.guardY);
      const anchoredByAttackMove = unit.attackMoveGoal !== null;
      if (!anchoredByAttackMove && fromGuard > leash + def.range + 1) return this.endAttack(unit, task);
    }

    const reach = Math.max(def.range, MELEE_REACH) + COMBAT.rangeSlack;
    if (edgeDistance(unit, target) <= reach) {
      if (unit.moveGoal) this.movement.stopMovement(unit);
      unit.state = 'attacking';
      unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
      if (unit.attackCooldown <= 0) {
        this.strike(unit, def, target);
        unit.attackCooldown = def.attackCooldown;
      }
      return;
    }

    // Fora de alcance: manter posição nunca persegue.
    if (unit.stance === 'holdPosition') return this.endAttack(unit, task);
    if (unit.moveStatus === 'failed') return this.endAttack(unit, task);
    unit.state = 'moving';
    task.repathTimer -= dt;
    if (!unit.moveGoal || task.repathTimer <= 0) {
      task.repathTimer = COMBAT.chaseRepathInterval;
      const goal = target.kind === 'unit' ? { x: target.x, y: target.y } : (findApproachPoint(this.world, rectOf(target), unit) ?? { x: target.x, y: target.y });
      this.movement.moveUnit(unit, goal);
    }
  }

  private strike(unit: UnitEntity, def: UnitDefinition, target: CombatTarget): void {
    const damage = computeDamage(def, target);
    if (def.range > 0 && def.projectileSpeed) {
      const id = this.world.nextProjectile();
      this.world.projectiles.push({
        id,
        owner: unit.owner,
        attackerId: unit.id,
        targetId: target.id,
        damage,
        speed: def.projectileSpeed,
        x: unit.x,
        y: unit.y,
        prevX: unit.x,
        prevY: unit.y,
        startX: unit.x,
        startY: unit.y,
        aimX: target.x,
        aimY: target.y,
      });
      this.world.emit({ type: 'projectileFired', projectileId: id, attackerId: unit.id });
      return;
    }
    this.world.emit({ type: 'meleeHit', attackerId: unit.id, targetId: target.id, x: target.x, y: target.y });
    this.applyDamage(target, damage, unit.id, unit.owner);
  }

  /** Fim do ataque: retoma ataque-mover, volta ao ponto de guarda (defensiva) ou fica ocioso. */
  private endAttack(unit: UnitEntity, task: AttackTask): void {
    unit.task = null;
    unit.scanTimer = 0;
    if (unit.attackMoveGoal) {
      const goal = unit.attackMoveGoal;
      if (Math.hypot(goal.x - unit.x, goal.y - unit.y) < 0.8) {
        unit.attackMoveGoal = null;
      } else {
        unit.state = 'moving';
        this.movement.moveUnit(unit, goal);
        return;
      }
    }
    if (task.auto && unit.stance === 'defensive' && Math.hypot(unit.x - unit.guardX, unit.y - unit.guardY) > 1) {
      unit.state = 'moving';
      this.movement.moveUnit(unit, { x: unit.guardX, y: unit.guardY });
      return;
    }
    if (unit.moveGoal) this.movement.stopMovement(unit);
    unit.state = 'idle';
  }

  // ------------------------------------------------------------------ busca automática

  /**
   * Unidades militares sem tarefa procuram inimigos no campo de visão (ou só no alcance,
   * em "manter posição"). Unidades em movimento comum ignoram inimigos; em ataque-mover, não.
   */
  private updateIdleCombatant(unit: UnitEntity, dt: number): void {
    if (unit.task) return;
    const def = getUnitDefinition(unit.type);
    if (!def.autoAttack || def.attack <= 0) return;
    if (unit.moveGoal && !unit.attackMoveGoal) return;
    unit.scanTimer -= dt;
    if (unit.scanTimer > 0) return;
    unit.scanTimer = COMBAT.scanInterval;

    const radius = unit.stance === 'holdPosition' ? Math.max(def.range, MELEE_REACH) + COMBAT.rangeSlack + 0.5 : def.lineOfSight;
    const target = this.findTarget(unit, radius);
    if (!target) return;
    if (!unit.attackMoveGoal && !unit.moveGoal) {
      unit.guardX = unit.x;
      unit.guardY = unit.y;
    }
    this.startAttack(unit, target, true);
  }

  /** Inimigo mais próximo no raio; prioriza quem atacou a unidade e unidades sobre edifícios. */
  private findTarget(unit: UnitEntity, radius: number): CombatTarget | null {
    const attacker = unit.lastAttackerId !== null ? this.world.getEntity(unit.lastAttackerId) : undefined;
    if (attacker?.kind === 'unit' && areEnemies(unit.owner, attacker.owner) && Math.hypot(attacker.x - unit.x, attacker.y - unit.y) <= radius + 2) return attacker;

    let best: CombatTarget | null = null;
    let bestDist = Infinity;
    for (const i of this.hash.queryRadius(unit.x, unit.y, radius, this.nearby)) {
      const other = this.hashed[i]!;
      if (!areEnemies(unit.owner, other.owner) || !this.world.entities.has(other.id)) continue;
      const d = Math.hypot(other.x - unit.x, other.y - unit.y);
      if (d < bestDist || (d === bestDist && best && other.id < best.id)) {
        best = other;
        bestDist = d;
      }
    }
    if (best) return best;
    for (const b of this.world.buildings) {
      if (!areEnemies(unit.owner, b.owner)) continue;
      const d = edgeDistance(unit, b);
      if (d <= radius && d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ projéteis e dano

  private updateProjectiles(dt: number): void {
    const list = this.world.projectiles;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]!;
      p.prevX = p.x;
      p.prevY = p.y;
      const target = this.world.getEntity(p.targetId);
      const alive = isCombatTarget(target) && !this.dying.has(target.id);
      if (alive) {
        p.aimX = target.x;
        p.aimY = target.y;
      }
      const dx = p.aimX - p.x;
      const dy = p.aimY - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (dist > step + PROJECTILE_HIT_RADIUS) {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        continue;
      }
      p.x = p.aimX;
      p.y = p.aimY;
      list.splice(i, 1);
      this.world.emit({ type: 'projectileHit', projectileId: p.id, targetId: alive ? target.id : null, x: p.x, y: p.y });
      if (alive) this.applyDamage(target, p.damage, p.attackerId, p.owner);
    }
  }

  applyDamage(target: CombatTarget, damage: number, attackerId: EntityId | null, attackerOwner: PlayerId): void {
    if (this.dying.has(target.id)) return;
    target.hp -= damage;
    target.lastDamagedAt = this.world.time;
    if (target.kind === 'unit') {
      target.lastAttackerId = attackerId;
      // Unidades militares paradas revidam de imediato.
      if (!target.task && !target.moveGoal) target.scanTimer = 0;
    }
    this.world.emit({ type: 'attacked', targetId: target.id, owner: target.owner, attackerOwner, x: target.x, y: target.y });
    if (target.hp <= 0) this.dying.set(target.id, attackerOwner);
  }

  private flushDeaths(): void {
    if (this.dying.size === 0) return;
    for (const [id, killerOwner] of this.dying) {
      const e = this.world.getEntity(id);
      if (!isCombatTarget(e)) continue;
      const owner = this.world.getPlayer(e.owner);
      if (owner) {
        if (e.kind === 'unit') owner.stats.unitsLost++;
        else owner.stats.buildingsLost++;
      }
      const killer = killerOwner !== null ? this.world.getPlayer(killerOwner) : undefined;
      if (killer) killer.stats.kills++;
      this.world.emit({ type: 'entityDied', id, kind: e.kind, entityType: e.type, owner: e.owner, killerOwner, x: e.x, y: e.y });
      this.world.removeEntity(id);
    }
    this.dying.clear();
  }
}
