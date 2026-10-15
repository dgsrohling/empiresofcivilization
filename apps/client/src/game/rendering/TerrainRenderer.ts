import type { GeneratedMap } from '@eoc/simulation';
import Phaser from 'phaser';
import { TILE_W, worldToScreen } from '../iso';
import { TERRAIN_FRAME_W, TERRAIN_TEXTURE, TERRAIN_VARIANTS, terrainFrame } from './textureKeys';

const CHUNK = 16;

interface TerrainChunk {
  blitter: Phaser.GameObjects.Blitter;
  bounds: Phaser.Geom.Rectangle;
}

/**
 * Renderiza o terreno em blocos (chunks) de 16×16 tiles usando Blitters
 * (um único lote de desenho por bloco). Blocos fora da câmera ficam invisíveis.
 */
export class TerrainRenderer {
  private readonly chunks: TerrainChunk[] = [];

  constructor(scene: Phaser.Scene, map: GeneratedMap) {
    const p = { x: 0, y: 0 };
    for (let cy = 0; cy < map.height; cy += CHUNK) {
      for (let cx = 0; cx < map.width; cx += CHUNK) {
        const blitter = scene.add.blitter(0, 0, TERRAIN_TEXTURE).setDepth(-1e9);
        const x1 = Math.min(map.width, cx + CHUNK);
        const y1 = Math.min(map.height, cy + CHUNK);
        for (let y = cy; y < y1; y++) {
          for (let x = cx; x < x1; x++) {
            const terrain = map.terrain[y * map.width + x] as number;
            const variant = variantFor(x, y);
            worldToScreen(x, y, p);
            blitter.create(p.x - TERRAIN_FRAME_W / 2, p.y - 1, terrainFrame(terrain, variant));
          }
        }
        const left = (cx - y1) * (TILE_W / 2) - 2;
        const right = (x1 - cy) * (TILE_W / 2) + 2;
        const top = worldToScreen(cx, cy).y - 2;
        const bottom = worldToScreen(x1, y1).y + 2;
        this.chunks.push({ blitter, bounds: new Phaser.Geom.Rectangle(left, top, right - left, bottom - top) });
      }
    }
  }

  cull(view: Phaser.Geom.Rectangle): void {
    for (const chunk of this.chunks) chunk.blitter.setVisible(Phaser.Geom.Intersects.RectangleToRectangle(chunk.bounds, view));
  }
}

function variantFor(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h >>> 0) % TERRAIN_VARIANTS) as number;
}
