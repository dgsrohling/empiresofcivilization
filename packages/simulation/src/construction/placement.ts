import { getBuildingDefinition, getTerrain, type BuildingDefinition } from '@eoc/game-data';
import { RESOURCE_TYPES, type CommandResult, type PlayerId, type ResourceAmounts } from '@eoc/shared';
import type { World } from '../core/World';
import type { PlayerState } from '../entities/types';

const RESOURCE_LABELS: Record<string, string> = { food: 'Comida', wood: 'Madeira', gold: 'Ouro', stone: 'Pedra' };

export interface PlacementCheck {
  ok: boolean;
  reason?: string;
  /** Tiles da área que impedem a construção (índices y * width + x). */
  invalidTiles: number[];
}

export function canAfford(player: PlayerState, cost: Partial<ResourceAmounts>): boolean {
  return RESOURCE_TYPES.every((r) => player.resources[r] >= (cost[r] ?? 0));
}

/** Mensagem com o primeiro recurso faltante, ou null se o custo pode ser pago. */
export function missingResourceMessage(player: PlayerState, cost: Partial<ResourceAmounts>): string | null {
  for (const r of RESOURCE_TYPES) {
    const need = cost[r] ?? 0;
    if (player.resources[r] < need) return `${RESOURCE_LABELS[r]} insuficiente (${Math.floor(player.resources[r])}/${need})`;
  }
  return null;
}

export function payCost(player: PlayerState, cost: Partial<ResourceAmounts>): void {
  for (const r of RESOURCE_TYPES) player.resources[r] -= cost[r] ?? 0;
}

/** O jogador pode construir este tipo de edifício agora (era, pré-requisitos, recursos)? */
export function checkBuildingAvailability(world: World, playerId: PlayerId, type: string, def?: BuildingDefinition): CommandResult {
  const definition = def ?? safeDefinition(type);
  const player = world.getPlayer(playerId);
  if (!definition || !definition.buildable) return { ok: false, reason: 'Edifício indisponível' };
  if (!player) return { ok: false, reason: 'Jogador inválido' };
  if (player.age < definition.requiredAge) return { ok: false, reason: `Requer a Era ${'I'.repeat(definition.requiredAge).replace('IIII', 'IV')}` };
  for (const required of definition.requiresBuildings) {
    if (!world.buildings.some((b) => b.owner === playerId && b.type === required && b.complete)) {
      return { ok: false, reason: `Requer ${getBuildingDefinition(required).name}` };
    }
  }
  const missing = missingResourceMessage(player, definition.cost);
  if (missing) return { ok: false, reason: missing };
  return { ok: true };
}

/**
 * Valida a posição de um edifício cujo tile superior esquerdo é (tx, ty):
 * dentro do mapa, terreno edificável, sem objetos estáticos e sem unidades de outros jogadores.
 * Unidades do próprio jogador são afastadas ao posicionar a obra.
 */
export function checkPlacement(world: World, playerId: PlayerId, type: string, tx: number, ty: number): PlacementCheck {
  const def = safeDefinition(type);
  if (!def) return { ok: false, reason: 'Edifício desconhecido', invalidTiles: [] };
  const availability = checkBuildingAvailability(world, playerId, type, def);
  const invalidTiles = findInvalidTiles(world, playerId, def, tx, ty);
  if (!availability.ok) return { ok: false, reason: availability.reason, invalidTiles };
  if (invalidTiles.length > 0) {
    const outside = tx < 0 || ty < 0 || tx + def.footprint.w > world.width || ty + def.footprint.h > world.height;
    return { ok: false, reason: outside ? 'Fora dos limites do mapa' : 'Local obstruído ou terreno impróprio', invalidTiles };
  }
  return { ok: true, invalidTiles };
}

function findInvalidTiles(world: World, playerId: PlayerId, def: BuildingDefinition, tx: number, ty: number): number[] {
  const { w, h } = def.footprint;
  const invalid: number[] = [];
  for (let y = ty; y < ty + h; y++) {
    for (let x = tx; x < tx + w; x++) {
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
        invalid.push(-1);
        continue;
      }
      const i = y * world.width + x;
      if (!getTerrain(world.map.terrain[i] as number).buildable || world.staticAt[i] !== 0) invalid.push(i);
    }
  }
  for (const u of world.units) {
    if (u.owner === playerId) continue;
    if (u.x + u.radius <= tx || u.x - u.radius >= tx + w || u.y + u.radius <= ty || u.y - u.radius >= ty + h) continue;
    const i = Math.floor(u.y) * world.width + Math.floor(u.x);
    if (!invalid.includes(i)) invalid.push(i);
  }
  return invalid;
}

function safeDefinition(type: string): BuildingDefinition | undefined {
  try {
    return getBuildingDefinition(type);
  } catch {
    return undefined;
  }
}
