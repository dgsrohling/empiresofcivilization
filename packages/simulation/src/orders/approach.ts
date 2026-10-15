import { ECONOMY } from '@eoc/game-data';
import type { World } from '../core/World';
import type { BuildingEntity, ResourceEntity, UnitEntity } from '../entities/types';
import { distanceToRect, findApproachPoint, rectOf } from '../economy/queries';
import type { MovementSystem } from '../movement/MovementSystem';

export type InteractionTarget = BuildingEntity | ResourceEntity;

/** A unidade está perto o bastante da borda do alvo para interagir (coletar, depositar, construir)? */
export function inReach(unit: UnitEntity, target: InteractionTarget, slack = 0): boolean {
  return distanceToRect(unit.x, unit.y, rectOf(target)) <= ECONOMY.interactionReach + slack;
}

/**
 * Leva a unidade até um ponto adjacente ao alvo. Se já estiver ao alcance, apenas marca a chegada.
 * Retorna false quando não existe ponto de acesso alcançável.
 */
export function approachTarget(world: World, movement: MovementSystem, unit: UnitEntity, target: InteractionTarget): boolean {
  if (inReach(unit, target)) {
    movement.stopMovement(unit, 'arrived');
    return true;
  }
  const point = findApproachPoint(world, rectOf(target), unit);
  if (!point) return false;
  unit.state = 'moving';
  movement.moveUnit(unit, point);
  return true;
}
