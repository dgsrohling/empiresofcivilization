import type { PlayerId, ResourceType } from '@eoc/shared';

export const TERRAIN_TEXTURE = 'terrain';
export const TERRAIN_VARIANTS = 4;
/** Frame de terreno com 1px de sobra em cada lado para evitar frestas entre tiles. */
export const TERRAIN_FRAME_W = 66;
export const TERRAIN_FRAME_H = 34;
export const TREE_VARIANTS = 3;

export const terrainFrame = (terrain: number, variant: number) => `t${terrain}_${variant}`;
export const unitTexture = (type: string, owner: PlayerId) => `unit_${type}_${owner}`;
export const buildingTexture = (type: string, owner: PlayerId) => `building_${type}_${owner}`;
export const resourceTexture = (nodeType: string, variant: number | string = 0) => `res_${nodeType}_${variant}`;
/** Árvore já cortada (tronco caído + toco). */
export const FELLED_TREE_TEXTURE = resourceTexture('tree', 'felled');
export const carryTexture = (resource: ResourceType) => `carry_${resource}`;
export const ARROW_TEXTURE = 'projectile_arrow';
export const rubbleTexture = (tiles: number) => `rubble_${tiles}`;
