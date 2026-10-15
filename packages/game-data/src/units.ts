import type { ResourceAmounts } from '@eoc/shared';
import type { ResourceNodeType } from './resources';

export interface ArmorValues {
  melee: number;
  pierce: number;
}

/** Capacidade de coleta (apenas unidades econômicas). */
export interface GathererStats {
  /** Quantidade máxima carregada antes de voltar ao depósito. */
  carryCapacity: number;
  /** Unidades de recurso coletadas por segundo, por tipo de fonte. */
  rates: Record<ResourceNodeType, number>;
}

export type UnitCategory = 'economic' | 'infantry' | 'archer' | 'cavalry' | 'siege';

/** Categorias usadas para bônus de ataque (unidades e edifícios). */
export type TargetCategory = UnitCategory | 'building';

/** corpo a corpo usa a armadura "melee"; à distância usa a armadura "pierce". */
export type DamageType = 'melee' | 'pierce';

export interface AttackBonus {
  vs: TargetCategory;
  damage: number;
}

export interface UnitDefinition {
  type: string;
  name: string;
  description: string;
  category: UnitCategory;
  maxHp: number;
  attack: number;
  armor: ArmorValues;
  /** Alcance de ataque em tiles (0 = corpo a corpo). */
  range: number;
  /** Velocidade em tiles por segundo. */
  speed: number;
  /** Campo de visão em tiles. */
  lineOfSight: number;
  /** Tempo entre ataques em segundos. */
  attackCooldown: number;
  damageType: DamageType;
  /** Dano extra contra categorias específicas. */
  bonuses: readonly AttackBonus[];
  /** Velocidade do projétil (tiles/s) para ataques à distância. */
  projectileSpeed?: number;
  /** Procura inimigos automaticamente dentro do campo de visão. */
  autoAttack: boolean;
  /** Raio de colisão em tiles. */
  radius: number;
  cost: Partial<ResourceAmounts>;
  /** Tempo de treinamento em segundos. */
  trainTime: number;
  populationCost: number;
  gatherer?: GathererStats;
  /** Pode construir edifícios (aldeões). */
  builder?: boolean;
}

export const UNIT_DEFINITIONS = {
  villager: {
    type: 'villager',
    name: 'Aldeão',
    description: 'Coleta recursos, constrói e repara estruturas.',
    category: 'economic',
    maxHp: 25,
    attack: 3,
    armor: { melee: 0, pierce: 0 },
    range: 0,
    speed: 1.5,
    lineOfSight: 4,
    attackCooldown: 2,
    damageType: 'melee',
    bonuses: [],
    autoAttack: false,
    radius: 0.24,
    cost: { food: 50 },
    trainTime: 25,
    populationCost: 1,
    gatherer: {
      carryCapacity: 10,
      rates: { tree: 0.42, goldMine: 0.38, stoneMine: 0.36, berryBush: 0.33 },
    },
    builder: true,
  },
  scout: {
    type: 'scout',
    name: 'Batedor',
    description: 'Unidade veloz com amplo campo de visão, especializada em exploração.',
    category: 'cavalry',
    maxHp: 45,
    attack: 3,
    armor: { melee: 0, pierce: 2 },
    range: 0,
    speed: 2.7,
    lineOfSight: 8,
    attackCooldown: 2,
    damageType: 'melee',
    bonuses: [{ vs: 'archer', damage: 3 }],
    autoAttack: true,
    radius: 0.34,
    cost: { food: 80 },
    trainTime: 30,
    populationCost: 1,
  },
  swordsman: {
    type: 'swordsman',
    name: 'Espadachim',
    description: 'Infantaria corpo a corpo equilibrada e resistente.',
    category: 'infantry',
    maxHp: 50,
    attack: 7,
    armor: { melee: 1, pierce: 1 },
    range: 0,
    speed: 1.6,
    lineOfSight: 5,
    attackCooldown: 2,
    damageType: 'melee',
    bonuses: [{ vs: 'building', damage: 3 }],
    autoAttack: true,
    radius: 0.26,
    cost: { food: 60, gold: 20 },
    trainTime: 21,
    populationCost: 1,
  },
  spearman: {
    type: 'spearman',
    name: 'Lanceiro',
    description: 'Infantaria barata, especializada contra cavalaria.',
    category: 'infantry',
    maxHp: 45,
    attack: 3,
    armor: { melee: 0, pierce: 0 },
    range: 0,
    speed: 1.8,
    lineOfSight: 5,
    attackCooldown: 3,
    damageType: 'melee',
    bonuses: [{ vs: 'cavalry', damage: 15 }],
    autoAttack: true,
    radius: 0.25,
    cost: { food: 35, wood: 25 },
    trainTime: 22,
    populationCost: 1,
  },
  archer: {
    type: 'archer',
    name: 'Arqueiro',
    description: 'Ataque à distância; frágil no combate próximo.',
    category: 'archer',
    maxHp: 30,
    attack: 4,
    armor: { melee: 0, pierce: 0 },
    range: 4.5,
    speed: 1.7,
    lineOfSight: 6.5,
    attackCooldown: 2,
    damageType: 'pierce',
    bonuses: [{ vs: 'infantry', damage: 1 }],
    projectileSpeed: 7,
    autoAttack: true,
    radius: 0.24,
    cost: { wood: 25, gold: 45 },
    trainTime: 35,
    populationCost: 1,
  },
} satisfies Record<string, UnitDefinition>;

export type UnitType = keyof typeof UNIT_DEFINITIONS;

export function getUnitDefinition(type: string): UnitDefinition {
  const def = (UNIT_DEFINITIONS as Record<string, UnitDefinition>)[type];
  if (!def) throw new Error(`Unidade desconhecida: ${type}`);
  return def;
}
