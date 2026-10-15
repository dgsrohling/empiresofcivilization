import type { AgeId, ResourceAmounts } from '@eoc/shared';
import type { UnitType } from './units';

/** Limite absoluto de população por jogador. */
export const MAX_POPULATION = 200;

export const STARTING_RESOURCES: ResourceAmounts = { food: 200, wood: 200, gold: 100, stone: 200 };

export const STARTING_UNITS: ReadonlyArray<{ type: UnitType; count: number }> = [
  { type: 'villager', count: 5 },
  { type: 'scout', count: 1 },
];

/** Cores de jogador (0xRRGGBB), indexadas por PlayerId. Índice 0 = natureza. */
export const PLAYER_COLORS: readonly number[] = [0xd8d0b0, 0x2f6fd6, 0xc8382f, 0xe0b420, 0x3a9d4a, 0x8e44ad, 0x16a3a3];

export const AGE_NAMES: Record<AgeId, string> = {
  1: 'Era dos Assentamentos',
  2: 'Era dos Reinos',
  3: 'Era das Fortalezas',
  4: 'Era dos Impérios',
};
