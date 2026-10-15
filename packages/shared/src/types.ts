/** Identificador numérico único de entidade dentro de uma partida. */
export type EntityId = number;

/** Identificador de jogador. 0 é reservado para a natureza (gaia). */
export type PlayerId = number;

export const GAIA_PLAYER_ID: PlayerId = 0;

/** Vetor 2D em coordenadas de mundo (unidade = 1 tile). */
export interface Vec2 {
  x: number;
  y: number;
}

export type ResourceType = 'food' | 'wood' | 'gold' | 'stone';

export const RESOURCE_TYPES: readonly ResourceType[] = ['food', 'wood', 'gold', 'stone'];

export type ResourceAmounts = Record<ResourceType, number>;

export type MapSizeId = 'small' | 'medium' | 'large';

export const MAP_SIZES: Record<MapSizeId, number> = {
  small: 64,
  medium: 128,
  large: 256,
};

/** Tipos de terreno. O valor numérico é armazenado em Uint8Array no mapa. */
export const Terrain = {
  Grass: 0,
  ForestFloor: 1,
  Dirt: 2,
  Sand: 3,
  Rock: 4,
  Mountain: 5,
  Water: 6,
  Shallows: 7,
  Road: 8,
} as const;

export type TerrainId = (typeof Terrain)[keyof typeof Terrain];

export const TERRAIN_COUNT = 9;

export type AgeId = 1 | 2 | 3 | 4;

export type EntityKind = 'unit' | 'building' | 'resource';
