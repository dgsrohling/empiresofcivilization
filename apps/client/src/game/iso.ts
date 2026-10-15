import type { Vec2 } from '@eoc/shared';

/** Largura e altura (em pixels) do losango de um tile isométrico. */
export const TILE_W = 64;
export const TILE_H = 32;

/**
 * Projeção isométrica 2:1. Coordenadas de mundo são em tiles (frações permitidas);
 * coordenadas de tela são pixels do "mundo renderizado" (antes da câmera).
 */
export function worldToScreen(wx: number, wy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = (wx - wy) * (TILE_W / 2);
  out.y = (wx + wy) * (TILE_H / 2);
  return out;
}

export function screenToWorld(sx: number, sy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = sy / TILE_H + sx / TILE_W;
  out.y = sy / TILE_H - sx / TILE_W;
  return out;
}

/** Retângulo (em pixels de tela) que envolve um mapa de `width × height` tiles. */
export function mapScreenBounds(width: number, height: number) {
  return {
    x: -height * (TILE_W / 2),
    y: 0,
    width: (width + height) * (TILE_W / 2),
    height: (width + height) * (TILE_H / 2),
  };
}
