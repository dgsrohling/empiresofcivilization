import { Terrain, type TerrainId } from '@eoc/shared';

export interface TerrainDefinition {
  id: TerrainId;
  key: string;
  name: string;
  walkable: boolean;
  buildable: boolean;
  /** Multiplicador de velocidade de movimento sobre o terreno. */
  speedMultiplier: number;
  /** Cor base usada no tile procedural e no minimapa. */
  color: string;
}

/** Indexado pelo id numérico do terreno. */
export const TERRAIN_DEFINITIONS: readonly TerrainDefinition[] = [
  { id: Terrain.Grass, key: 'grass', name: 'Gramado', walkable: true, buildable: true, speedMultiplier: 1, color: '#5f8f3a' },
  { id: Terrain.ForestFloor, key: 'forest', name: 'Floresta', walkable: true, buildable: true, speedMultiplier: 0.9, color: '#456f2c' },
  { id: Terrain.Dirt, key: 'dirt', name: 'Terra', walkable: true, buildable: true, speedMultiplier: 1, color: '#8a6a43' },
  { id: Terrain.Sand, key: 'sand', name: 'Areia', walkable: true, buildable: true, speedMultiplier: 0.9, color: '#cdb77e' },
  { id: Terrain.Rock, key: 'rock', name: 'Rochas', walkable: true, buildable: false, speedMultiplier: 0.85, color: '#7c7a72' },
  { id: Terrain.Mountain, key: 'mountain', name: 'Montanha', walkable: false, buildable: false, speedMultiplier: 0, color: '#4e4a45' },
  { id: Terrain.Water, key: 'water', name: 'Água', walkable: false, buildable: false, speedMultiplier: 0, color: '#2f5f8f' },
  { id: Terrain.Shallows, key: 'shallows', name: 'Vau', walkable: true, buildable: false, speedMultiplier: 0.6, color: '#5a8fa8' },
  { id: Terrain.Road, key: 'road', name: 'Estrada', walkable: true, buildable: false, speedMultiplier: 1.25, color: '#a8875c' },
];

export function getTerrain(id: number): TerrainDefinition {
  const def = TERRAIN_DEFINITIONS[id];
  if (!def) throw new Error(`Terreno desconhecido: ${id}`);
  return def;
}
