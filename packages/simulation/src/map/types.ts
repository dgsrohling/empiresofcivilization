import type { ResourceNodeType } from '@eoc/game-data';
import type { Vec2 } from '@eoc/shared';

export interface ResourceNodeSpec {
  type: ResourceNodeType;
  /** Tile ocupado pelo recurso. */
  x: number;
  y: number;
}

export interface GeneratedMap {
  seed: number;
  /** Tentativa de geração que passou na validação (0 = primeira). */
  attempt: number;
  width: number;
  height: number;
  /** Id de terreno por tile (índice = y * width + x). */
  terrain: Uint8Array;
  /**
   * Pontos de nascimento. O Centro da Vila ocupa os tiles [x-2, x+1] × [y-2, y+1],
   * ou seja, seu centro em coordenadas de mundo é exatamente (x, y).
   */
  spawns: Vec2[];
  resources: ResourceNodeSpec[];
}

export interface MapGenOptions {
  seed: number;
  size: number;
  playerCount: number;
  /** Força presença/ausência de rio. Indefinido = decidido pela seed. */
  river?: boolean;
}

/** Tamanho (lado) do Centro da Vila inicial, em tiles. */
export const START_TC_SIZE = 4;

export function startFootprint(spawn: Vec2): { x: number; y: number; w: number; h: number } {
  return { x: spawn.x - START_TC_SIZE / 2, y: spawn.y - START_TC_SIZE / 2, w: START_TC_SIZE, h: START_TC_SIZE };
}
