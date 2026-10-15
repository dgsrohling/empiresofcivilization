import { getBuildingDefinition, getUnitDefinition, type TargetCategory, type UnitDefinition } from '@eoc/game-data';
import type { BuildingEntity, Entity, UnitEntity } from '../entities/types';
import { distanceToRect, rectOf } from '../economy/queries';

export type CombatTarget = UnitEntity | BuildingEntity;

export function isCombatTarget(e: Entity | undefined): e is CombatTarget {
  return !!e && (e.kind === 'unit' || e.kind === 'building');
}

export function categoryOf(target: CombatTarget): TargetCategory {
  return target.kind === 'building' ? 'building' : getUnitDefinition(target.type).category;
}

export function armorOf(target: CombatTarget, damageType: 'melee' | 'pierce'): number {
  const armor = target.kind === 'building' ? getBuildingDefinition(target.type).armor : getUnitDefinition(target.type).armor;
  return armor[damageType];
}

/**
 * Dano de um golpe: ataque − armadura do tipo correspondente + bônus contra a categoria do alvo,
 * nunca menos que 1 (todo golpe causa algum dano).
 */
export function computeDamage(attacker: UnitDefinition, target: CombatTarget): number {
  const category = categoryOf(target);
  let damage = attacker.attack - armorOf(target, attacker.damageType);
  for (const bonus of attacker.bonuses) if (bonus.vs === category) damage += bonus.damage;
  return Math.max(1, damage);
}

/** Distância entre as bordas do atacante e do alvo (0 se encostados). */
export function edgeDistance(unit: UnitEntity, target: CombatTarget): number {
  if (target.kind === 'building') return Math.max(0, distanceToRect(unit.x, unit.y, rectOf(target)) - unit.radius);
  return Math.max(0, Math.hypot(target.x - unit.x, target.y - unit.y) - unit.radius - target.radius);
}
