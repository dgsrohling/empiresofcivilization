import { COMBAT, getBuildingDefinition, getUnitDefinition } from '@eoc/game-data';
import { MAX_COMMAND_UNITS, type CommandResult, type EntityId, type GameCommand, type PlayerId } from '@eoc/shared';
import { isCombatTarget } from '../combat/damage';
import { checkPlacement, missingResourceMessage } from '../construction/placement';
import { areEnemies } from '../core/players';
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
    case 'attack': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'fighter');
      if (!unitCheck.ok) return unitCheck;
      const target = world.getEntity(command.targetId);
      if (!isCombatTarget(target)) return { ok: false, reason: 'Alvo inválido' };
      if (!areEnemies(playerId, target.owner)) return { ok: false, reason: 'O alvo não é inimigo' };
      return { ok: true };
    }
    case 'attackMove': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'fighter');
      if (!unitCheck.ok) return unitCheck;
      if (!Number.isFinite(command.target.x) || !Number.isFinite(command.target.y)) return { ok: false, reason: 'Destino inválido' };
      return { ok: true };
    }
    case 'setStance': {
      if (!['aggressive', 'defensive', 'holdPosition'].includes(command.stance)) return { ok: false, reason: 'Postura inválida' };
      return validateOwnedUnits(world, playerId, command.unitIds);
    }
    case 'repair': {
      const unitCheck = validateOwnedUnits(world, playerId, command.unitIds, 'builder');
      if (!unitCheck.ok) return unitCheck;
      const site = world.getEntity(command.buildingId);
      if (!site || site.kind !== 'building' || site.owner !== playerId) return { ok: false, reason: 'Edifício inválido' };
      if (!site.complete) return { ok: false, reason: 'Obras são construídas, não reparadas' };
      if (site.hp >= site.maxHp) return { ok: false, reason: 'O edifício não está danificado' };
      return { ok: true };
    }
    case 'train': {
      const b = world.getEntity(command.buildingId);
      if (!b || b.kind !== 'building' || b.owner !== playerId) return { ok: false, reason: 'Edifício inválido' };
      if (!b.complete) return { ok: false, reason: 'O edifício ainda está em construção' };
      if (!getBuildingDefinition(b.type).trains.includes(command.unitType)) return { ok: false, reason: 'Este edifício não treina essa unidade' };
      if (b.queue.length >= COMBAT.maxQueue) return { ok: false, reason: 'Fila de treinamento cheia' };
      const player = world.getPlayer(playerId)!;
      const missing = missingResourceMessage(player, getUnitDefinition(command.unitType).cost);
      return missing ? { ok: false, reason: missing } : { ok: true };
    }
    case 'cancelTrain': {
      const b = world.getEntity(command.buildingId);
      if (!b || b.kind !== 'building' || b.owner !== playerId) return { ok: false, reason: 'Edifício inválido' };
      if (!Number.isInteger(command.index) || command.index < 0 || command.index >= b.queue.length) return { ok: false, reason: 'Item da fila inválido' };
      return { ok: true };
    }
    case 'setRallyPoint': {
      const b = world.getEntity(command.buildingId);
      if (!b || b.kind !== 'building' || b.owner !== playerId) return { ok: false, reason: 'Edifício inválido' };
      if (getBuildingDefinition(b.type).trains.length === 0) return { ok: false, reason: 'Este edifício não treina unidades' };
      const { x, y } = command.target;
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= world.width || y >= world.height) return { ok: false, reason: 'Ponto inválido' };
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

function validateOwnedUnits(world: World, playerId: PlayerId, ids: readonly EntityId[], capability?: 'gatherer' | 'builder' | 'fighter'): CommandResult {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, reason: 'Nenhuma unidade selecionada' };
  if (ids.length > MAX_COMMAND_UNITS) return { ok: false, reason: 'Unidades demais em um único comando' };
  for (const id of ids) {
    const entity = world.getEntity(id);
    if (!entity || entity.kind !== 'unit') return { ok: false, reason: 'Unidade inexistente' };
    if (entity.owner !== playerId) return { ok: false, reason: 'Unidade não pertence ao jogador' };
    const def = getUnitDefinition(entity.type);
    if (capability === 'gatherer' && !def.gatherer) return { ok: false, reason: 'Apenas aldeões podem coletar recursos' };
    if (capability === 'builder' && !def.builder) return { ok: false, reason: 'Apenas aldeões podem construir' };
    if (capability === 'fighter' && def.attack <= 0) return { ok: false, reason: 'Esta unidade não pode atacar' };
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
