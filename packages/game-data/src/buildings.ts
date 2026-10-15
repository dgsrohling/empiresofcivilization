import type { AgeId, ResourceAmounts, ResourceType } from '@eoc/shared';
import type { ArmorValues } from './units';

export interface BuildingDefinition {
  type: string;
  name: string;
  description: string;
  maxHp: number;
  armor: ArmorValues;
  /** Dimensões em tiles. */
  footprint: { w: number; h: number };
  lineOfSight: number;
  populationProvided: number;
  cost: Partial<ResourceAmounts>;
  /** Tempo de construção em segundos, com um único aldeão. */
  buildTime: number;
  requiredAge: AgeId;
  /** Edifícios concluídos exigidos antes de poder construir este. */
  requiresBuildings: readonly string[];
  /** Pode ser construído por aldeões (o Centro da Vila só a partir da Era III). */
  buildable: boolean;
  /** Recursos que podem ser depositados neste edifício. */
  dropsiteFor: readonly ResourceType[];
  /** Atalho de teclado no menu de construção. */
  hotkey?: string;
}

export const BUILDING_DEFINITIONS = {
  townCenter: {
    type: 'townCenter',
    name: 'Centro da Vila',
    description: 'Centro econômico do assentamento. Recebe todos os recursos.',
    maxHp: 2400,
    armor: { melee: 3, pierce: 5 },
    footprint: { w: 4, h: 4 },
    lineOfSight: 8,
    populationProvided: 10,
    cost: { wood: 275, stone: 100 },
    buildTime: 150,
    requiredAge: 3,
    requiresBuildings: [],
    buildable: true,
    dropsiteFor: ['food', 'wood', 'gold', 'stone'],
  },
  house: {
    type: 'house',
    name: 'Casa',
    description: 'Aumenta o limite populacional em 5.',
    maxHp: 550,
    armor: { melee: 0, pierce: 7 },
    footprint: { w: 2, h: 2 },
    lineOfSight: 2,
    populationProvided: 5,
    cost: { wood: 25 },
    buildTime: 25,
    requiredAge: 1,
    requiresBuildings: [],
    buildable: true,
    dropsiteFor: [],
    hotkey: 'C',
  },
  lumberCamp: {
    type: 'lumberCamp',
    name: 'Depósito de Madeira',
    description: 'Recebe madeira. Construa perto de florestas para encurtar o transporte.',
    maxHp: 1000,
    armor: { melee: 0, pierce: 7 },
    footprint: { w: 2, h: 2 },
    lineOfSight: 4,
    populationProvided: 0,
    cost: { wood: 100 },
    buildTime: 35,
    requiredAge: 1,
    requiresBuildings: [],
    buildable: true,
    dropsiteFor: ['wood'],
    hotkey: 'M',
  },
  miningCamp: {
    type: 'miningCamp',
    name: 'Depósito de Mineração',
    description: 'Recebe ouro e pedra. Construa perto das minas.',
    maxHp: 1000,
    armor: { melee: 0, pierce: 7 },
    footprint: { w: 2, h: 2 },
    lineOfSight: 4,
    populationProvided: 0,
    cost: { wood: 100 },
    buildTime: 35,
    requiredAge: 1,
    requiresBuildings: [],
    buildable: true,
    dropsiteFor: ['gold', 'stone'],
    hotkey: 'O',
  },
  barracks: {
    type: 'barracks',
    name: 'Quartel',
    description: 'Treina infantaria (treinamento disponível na Fase 4).',
    maxHp: 1200,
    armor: { melee: 0, pierce: 7 },
    footprint: { w: 3, h: 3 },
    lineOfSight: 5,
    populationProvided: 0,
    cost: { wood: 175 },
    buildTime: 50,
    requiredAge: 1,
    requiresBuildings: [],
    buildable: true,
    dropsiteFor: [],
    hotkey: 'Q',
  },
} satisfies Record<string, BuildingDefinition>;

export type BuildingType = keyof typeof BUILDING_DEFINITIONS;

/** Ordem de exibição no menu de construção dos aldeões. */
export const BUILD_MENU: readonly BuildingType[] = ['house', 'lumberCamp', 'miningCamp', 'barracks', 'townCenter'];

export function getBuildingDefinition(type: string): BuildingDefinition {
  const def = (BUILDING_DEFINITIONS as Record<string, BuildingDefinition>)[type];
  if (!def) throw new Error(`Edifício desconhecido: ${type}`);
  return def;
}
