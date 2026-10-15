import { STARTING_RESOURCES } from '@eoc/game-data';
import type { PlayerId, ResourceAmounts } from '@eoc/shared';
import type { PlayerState } from '../entities/types';

export interface PlayerInit {
  id: PlayerId;
  name: string;
  color: number;
  isHuman: boolean;
  resources?: ResourceAmounts;
}

const zero = (): ResourceAmounts => ({ food: 0, wood: 0, gold: 0, stone: 0 });

/** Cria o estado inicial de um jogador com modificadores neutros. */
export function createPlayerState(init: PlayerInit): PlayerState {
  return {
    id: init.id,
    name: init.name,
    color: init.color,
    isHuman: init.isHuman,
    resources: { ...(init.resources ?? STARTING_RESOURCES) },
    population: 0,
    populationCap: 0,
    age: 1,
    modifiers: { gatherRate: { food: 1, wood: 1, gold: 1, stone: 1 }, carryCapacity: 0, buildSpeed: 1, trainSpeed: 1 },
    stats: { gathered: zero(), unitsTrained: 0, unitsLost: 0, kills: 0, buildingsLost: 0 },
  };
}

/** Jogadores diferentes são inimigos; a natureza (0) é neutra. Times virão com o multiplayer. */
export function areEnemies(a: PlayerId, b: PlayerId): boolean {
  return a !== b && a !== 0 && b !== 0;
}
