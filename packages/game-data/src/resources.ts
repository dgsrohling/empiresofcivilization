import type { ResourceType } from '@eoc/shared';

export type ResourceNodeType = 'tree' | 'goldMine' | 'stoneMine' | 'berryBush';

export interface ResourceNodeDefinition {
  type: ResourceNodeType;
  name: string;
  resource: ResourceType;
  amount: number;
}

export const RESOURCE_NODE_DEFINITIONS: Record<ResourceNodeType, ResourceNodeDefinition> = {
  tree: { type: 'tree', name: 'Árvore', resource: 'wood', amount: 100 },
  goldMine: { type: 'goldMine', name: 'Mina de Ouro', resource: 'gold', amount: 800 },
  stoneMine: { type: 'stoneMine', name: 'Mina de Pedra', resource: 'stone', amount: 350 },
  berryBush: { type: 'berryBush', name: 'Arbusto Frutífero', resource: 'food', amount: 125 },
};
