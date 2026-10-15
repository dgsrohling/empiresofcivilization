import { getUnitDefinition } from '@eoc/game-data';
import { MAX_COMMAND_UNITS, type CommandResult, type EntityId, type GameCommand, type PlayerId } from '@eoc/shared';
import { checkPlacement } from '../construction/placement';
import type { World } from '../core/World';
import type { UnitEntity } from '../entities/types';

/**
 * Valida comandos antes de entrarem na fila da simulação. Mesma lógica será usada pelo
 * servidor autoritativo: nunca confiar no cliente quanto a propriedade, existência ou limites.
 */
export function validateCommand(world: World, playerId: PlayerId, command: GameCommand): CommandResult {
  if (!world.getPlayer(playerId)) return { ok: false, reason: 'Jogador inválido' };
  switch (command.type) {
    case 'move': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds);
      if (!unitCheck.ok) return unitCheck;
      const { x, y } = command.target;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'Destino inválido' };
      return { ok: true };
    }
    case 'stop':
      return validateOwnedUnits(world, playerId, command.unitIds);
    case 'gather': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'gatherer');
      if (!unitCheck.ok) return unitCheck;
      const target = world.getEntity(command.targetId);
      if (!target || target.kind !== 'resource') return { ok: false, reason: 'Alvo não é uma fonte de recurso' };
      if (target.amount <= 0) return { ok: false, reason: 'Recurso esgotado' };
      return { ok: true };
    }
    case 'placeBuilding': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'builder');
      if (!unitCheck.ok) return unitCheck;
      if (!Number.isInteger(command.tileX) || !Number.isInteger(command.tileY)) return { ok: false, reason: 'Posição inválida' };
      const placement = checkPlacement(world, playerId, command.buildingType, command.tileX, command.tileY);
      return placement.ok ? { ok: true } : { ok: false, reason: placement.reason ?? 'Posição inválida' };
    }
    case 'construct': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'builder');
      if (!unitCheck.ok) return unitCheck;
      const site = world.getEntity(command.buildingId);
      if (!site || site.kind !== 'building' || site.owner !== playerId) return { ok: false, reason: 'Obra inválida' };
      if (site.complete) return { ok: false, reason: 'O edifício já está concluído' };
      return { ok: true };
    }
    case 'cancelBuilding': {
      const site = world.getEntity(command.buildingId);
      if (!site || site.kind !== 'building' || site.owner !== playerId) return { ok: false, reason: 'Obra inválida' };
      if (site.complete) return { ok: false, reason: 'Somente obras não concluídas podem ser canceladas' };
      return { ok: true };
    }
    case 'deposit': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'gatherer');
      if (!unitCheck.ok) return unitCheck;
      const dropsite = world.getEntity(command.dropsiteId);
      if (!dropsite || dropsite.kind !== 'building') return { ok: false, reason: 'Depósito inválido' };
      if (dropsite.owner !== playerId) return { ok: false, reason: 'O depósito não pertence ao jogador' };
      if (!dropsite.complete) return { ok: false, reason: 'O depósito ainda não foi concluído' };
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'Comando desconhecido' };
  }
}

function validateOwnedUnits(world: World, playerId: PlayerId, ids: readonly EntityId[], capability?: 'gatherer' | 'builder'): CommandResult {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, reason: 'Nenhuma unidade selecionada' };
  if (ids.length > MAX_COMMAND_UNITS) return { ok: false, reason: 'Unidades demais em um único comando' };
  for (const id of ids) {
    const entity = world.getEntity(id);
    if (!entity || entity.kind !== 'unit') return { ok: false, reason: 'Unidade inexistente' };
    if (entity.owner !== playerId) return { ok: false, reason: 'Unidade não pertence ao jogador' };
    const def = getUnitDefinition(entity.type);
    if (capability === 'gatherer' && !def.gatherer) return { ok: false, reason: 'Apenas aldeões podem coletar recursos' };
    if (capability === 'builder' && !def.builder) return { ok: false, reason: 'Apenas aldeões podem construir' };
  }
  return { ok: true };
}

export function resolveUnits(world: World, ids: readonly EntityId[]): UnitEntity[] {
  const units: UnitEntity[] = [];
  const seen = new Set<EntityId>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const e = world.getEntity(id);
    if (e && e.kind === 'unit') units.push(e);
  }
  return units;
}
