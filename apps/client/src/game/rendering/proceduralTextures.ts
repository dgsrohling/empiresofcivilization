import { BUILDING_DEFINITIONS, TERRAIN_DEFINITIONS } from '@eoc/game-data';
import { RESOURCE_TYPES, Terrain, TERRAIN_COUNT, type PlayerId, type ResourceType } from '@eoc/shared';
import { Rng } from '@eoc/simulation';
import type Phaser from 'phaser';
import { buildingArt, drawBuilding } from './art/buildings';
import { SOLDIER_SIZE, drawArcher, drawArrow, drawRubble, drawSpearman, drawSwordsman } from './art/units';
import { circle, diamond, poly, shadow, type Ctx, type Point } from './art/primitives';
import { shade, toCssColor } from './color';
import {
  ARROW_TEXTURE,
  FELLED_TREE_TEXTURE,
  TERRAIN_FRAME_H,
  TERRAIN_FRAME_W,
  TERRAIN_TEXTURE,
  TERRAIN_VARIANTS,
  TREE_VARIANTS,
  buildingTexture,
  carryTexture,
  resourceTexture,
  rubbleTexture,
  terrainFrame,
  unitTexture,
} from './textureKeys';

/**
 * Gráficos provisórios originais, desenhados proceduralmente em canvas.
 * Para trocar por arte definitiva basta carregar spritesheets com as mesmas chaves
 * (ver textureKeys.ts) e respeitar a origem (ponto de apoio) documentada em ORIGINS.
 */


/** Ponto de apoio (pés / centro da base) de cada textura, como fração da largura/altura. */
export const ORIGINS = {
  tree: { x: 0.5, y: 66 / 72 },
  goldMine: { x: 0.5, y: 34 / 44 },
  stoneMine: { x: 0.5, y: 34 / 44 },
  berryBush: { x: 0.5, y: 26 / 34 },
  villager: { x: 0.5, y: 35 / 38 },
  scout: { x: 0.5, y: 41 / 44 },
  soldier: { x: SOLDIER_SIZE.footX / SOLDIER_SIZE.w, y: SOLDIER_SIZE.footY / SOLDIER_SIZE.h },
} as const;

/** Ponto de apoio de uma unidade, por tipo. */
export function unitOrigin(type: string): { x: number; y: number } {
  if (type === 'villager') return ORIGINS.villager;
  if (type === 'scout') return ORIGINS.scout;
  return ORIGINS.soldier;
}

/** Ponto de apoio de um edifício (centro do losango da base). */
export function buildingOrigin(type: string): { x: number; y: number } {
  const art = buildingArt(type);
  return { x: 0.5, y: art.baseY / art.height };
}

const GUTTER = 2;

export function generateTextures(scene: Phaser.Scene, playerColors: ReadonlyMap<PlayerId, number>): void {
  createTerrainAtlas(scene);
  for (let v = 0; v < TREE_VARIANTS; v++) canvasTexture(scene, resourceTexture('tree', v), 48, 72, (ctx) => drawTree(ctx, v));
  canvasTexture(scene, FELLED_TREE_TEXTURE, 48, 72, drawFelledTree);
  canvasTexture(scene, ARROW_TEXTURE, 14, 4, drawArrow);
  for (const n of [2, 3, 4]) canvasTexture(scene, rubbleTexture(n), n * 64 + 8, n * 32 + 20, (ctx) => drawRubble(ctx, n, n * 7919));
  for (const r of RESOURCE_TYPES) canvasTexture(scene, carryTexture(r), 12, 10, (ctx) => drawCarry(ctx, r));
  canvasTexture(scene, resourceTexture('goldMine'), 56, 44, (ctx) => drawMine(ctx, '#8d8a80', '#f2c94c'));
  canvasTexture(scene, resourceTexture('stoneMine'), 56, 44, (ctx) => drawMine(ctx, '#a19d94', null));
  canvasTexture(scene, resourceTexture('berryBush'), 40, 34, drawBerryBush);
  for (const [owner, color] of playerColors) {
    canvasTexture(scene, unitTexture('villager', owner), 26, 38, (ctx) => drawVillager(ctx, color));
    canvasTexture(scene, unitTexture('scout', owner), 48, 44, (ctx) => drawScout(ctx, color));
    canvasTexture(scene, unitTexture('swordsman', owner), SOLDIER_SIZE.w, SOLDIER_SIZE.h, (ctx) => drawSwordsman(ctx, color));
    canvasTexture(scene, unitTexture('spearman', owner), SOLDIER_SIZE.w, SOLDIER_SIZE.h, (ctx) => drawSpearman(ctx, color));
    canvasTexture(scene, unitTexture('archer', owner), SOLDIER_SIZE.w, SOLDIER_SIZE.h, (ctx) => drawArcher(ctx, color));
    for (const type of Object.keys(BUILDING_DEFINITIONS)) {
      const art = buildingArt(type);
      canvasTexture(scene, buildingTexture(type, owner), art.width, art.height, (ctx) => drawBuilding(ctx, type, color));
    }
  }
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Falha ao criar textura ${key}`);
  draw(tex.getContext());
  tex.refresh();
}

// ---------------------------------------------------------------------------------------------
// Terreno
// ---------------------------------------------------------------------------------------------

function createTerrainAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(TERRAIN_TEXTURE)) scene.textures.remove(TERRAIN_TEXTURE);
  const strideX = TERRAIN_FRAME_W + GUTTER;
  const strideY = TERRAIN_FRAME_H + GUTTER;
  const tex = scene.textures.createCanvas(TERRAIN_TEXTURE, TERRAIN_VARIANTS * strideX, TERRAIN_COUNT * strideY);
  if (!tex) throw new Error('Falha ao criar atlas de terreno');
  const ctx = tex.getContext();
  const rng = new Rng(0xc0ffee);
  for (let t = 0; t < TERRAIN_COUNT; t++) {
    for (let v = 0; v < TERRAIN_VARIANTS; v++) {
      const ox = v * strideX;
      const oy = t * strideY;
      drawTerrainTile(ctx, ox, oy, t, rng);
      tex.add(terrainFrame(t, v), 0, ox, oy, TERRAIN_FRAME_W, TERRAIN_FRAME_H);
    }
  }
  tex.refresh();
}

function speckle(ctx: Ctx, rng: Rng, ox: number, oy: number, count: number, colors: string[], min = 1, max = 2): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng.pick(colors);
    const s = rng.range(min, max);
    ctx.fillRect(ox + rng.range(0, TERRAIN_FRAME_W), oy + rng.range(0, TERRAIN_FRAME_H), s, s * 0.8);
  }
}

function drawTerrainTile(ctx: Ctx, ox: number, oy: number, terrain: number, rng: Rng): void {
  const base = TERRAIN_DEFINITIONS[terrain]!.color;
  const W = TERRAIN_FRAME_W;
  const H = TERRAIN_FRAME_H;
  ctx.save();
  diamond(ctx, ox, oy, W, H);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.clip();
  const light = ctx.createLinearGradient(ox, oy, ox + W, oy + H);
  light.addColorStop(0, 'rgba(255,255,240,0.07)');
  light.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = light;
  ctx.fillRect(ox, oy, W, H);

  switch (terrain) {
    case Terrain.Grass: {
      speckle(ctx, rng, ox, oy, 70, [shade(base, -0.15), shade(base, 0.12), shade(base, -0.06)]);
      ctx.lineWidth = 1;
      for (let i = 0; i < 22; i++) {
        const x = ox + rng.range(4, W - 4);
        const y = oy + rng.range(4, H - 2);
        ctx.strokeStyle = rng.chance(0.5) ? shade(base, -0.25) : shade(base, 0.2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rng.range(-1.5, 1.5), y - rng.range(2, 4));
        ctx.stroke();
      }
      if (rng.chance(0.3)) speckle(ctx, rng, ox, oy, 3, ['#e8e2a0', '#d9a3c8'], 1.5, 2);
      break;
    }
    case Terrain.ForestFloor:
      speckle(ctx, rng, ox, oy, 90, [shade(base, -0.25), shade(base, 0.08), '#5b4a2a', '#4a3d22'], 1, 2.5);
      break;
    case Terrain.Dirt:
      speckle(ctx, rng, ox, oy, 80, [shade(base, -0.18), shade(base, 0.15), '#6f5434'], 1, 2.2);
      speckle(ctx, rng, ox, oy, 6, ['#b9a283', '#9a8a74'], 2, 3);
      break;
    case Terrain.Sand:
      speckle(ctx, rng, ox, oy, 90, [shade(base, -0.1), shade(base, 0.15), '#e8dcae'], 0.8, 1.4);
      break;
    case Terrain.Rock:
      speckle(ctx, rng, ox, oy, 50, [shade(base, -0.2), shade(base, 0.15)], 1, 2);
      for (let i = 0; i < 6; i++) stone(ctx, ox + rng.range(8, W - 8), oy + rng.range(6, H - 6), rng.range(2, 4), base);
      break;
    case Terrain.Mountain:
      speckle(ctx, rng, ox, oy, 40, [shade(base, -0.25), shade(base, 0.1)], 1, 2.5);
      for (let i = 0; i < 3; i++) {
        const x = ox + rng.range(10, W - 22);
        const y = oy + rng.range(10, H - 4);
        const w = rng.range(12, 20);
        const h = rng.range(8, 13);
        ctx.fillStyle = shade(base, 0.18);
        poly(ctx, [[x, y], [x + w * 0.45, y - h], [x + w * 0.55, y]]);
        ctx.fillStyle = shade(base, -0.28);
        poly(ctx, [[x + w * 0.45, y - h], [x + w, y], [x + w * 0.55, y]]);
      }
      break;
    case Terrain.Water:
    case Terrain.Shallows: {
      speckle(ctx, rng, ox, oy, 40, [shade(base, -0.12), shade(base, 0.08)], 1, 2);
      if (terrain === Terrain.Shallows) speckle(ctx, rng, ox, oy, 25, ['#c9b98a', '#a99b74'], 1, 2);
      ctx.strokeStyle = shade(base, 0.35, 0.8);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const x = ox + rng.range(8, W - 18);
        const y = oy + rng.range(6, H - 6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 4, y - 2, x + 8, y);
        ctx.quadraticCurveTo(x + 12, y + 2, x + 16, y);
        ctx.stroke();
      }
      break;
    }
    case Terrain.Road:
      speckle(ctx, rng, ox, oy, 70, [shade(base, -0.15), shade(base, 0.12), '#8a7050'], 1, 2);
      for (let i = 0; i < 5; i++) stone(ctx, ox + rng.range(8, W - 8), oy + rng.range(6, H - 6), rng.range(1.5, 2.5), '#9c9284');
      break;
  }
  ctx.restore();
}

function stone(ctx: Ctx, x: number, y: number, r: number, base: string): void {
  ctx.fillStyle = shade(base, -0.3);
  ctx.beginPath();
  ctx.ellipse(x + 0.6, y + 0.6, r, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(base, 0.25);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Recursos naturais
// ---------------------------------------------------------------------------------------------

function drawTree(ctx: Ctx, variant: number): void {
  shadow(ctx, 26, 66, 15, 5);
  ctx.fillStyle = '#5a3d22';
  ctx.fillRect(21, 42, 6, 24);
  ctx.fillStyle = '#43301b';
  ctx.fillRect(24, 42, 3, 24);
  if (variant === 2) {
    // Conífera
    const layers: Array<[number, number, number]> = [
      [50, 18, 18],
      [38, 15, 16],
      [26, 12, 14],
    ];
    for (const [y, hw, h] of layers) {
      ctx.fillStyle = '#2f5a2c';
      poly(ctx, [[24 - hw, y], [24, y - h - 6], [24 + hw, y]]);
      ctx.fillStyle = '#244a23';
      poly(ctx, [[24, y - h - 6], [24 + hw, y], [24, y]]);
    }
    return;
  }
  const dark = variant === 0 ? '#2f5d27' : '#3b6a2a';
  const mid = variant === 0 ? '#3f7a32' : '#4d8436';
  const lightC = variant === 0 ? '#5a9a43' : '#6aa64a';
  circle(ctx, 24, 32, 17, dark);
  circle(ctx, 13, 38, 11, dark);
  circle(ctx, 35, 38, 11, dark);
  circle(ctx, 22, 28, 14, mid);
  circle(ctx, 14, 34, 8, mid);
  circle(ctx, 31, 33, 9, mid);
  circle(ctx, 19, 22, 8, lightC);
  circle(ctx, 28, 26, 5, lightC);
}

function drawFelledTree(ctx: Ctx): void {
  shadow(ctx, 24, 64, 18, 5);
  // Toco
  ctx.fillStyle = '#4a3420';
  ctx.beginPath();
  ctx.ellipse(16, 63, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(11, 58, 10, 5);
  ctx.fillStyle = '#d6b07a';
  ctx.beginPath();
  ctx.ellipse(16, 58, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tronco caído
  ctx.fillStyle = '#5a3d22';
  poly(ctx, [[20, 61], [42, 52], [44, 56], [22, 65]]);
  ctx.fillStyle = '#6e4a2a';
  poly(ctx, [[20, 61], [42, 52], [43, 54], [21, 63]]);
  ctx.fillStyle = '#d6b07a';
  ctx.beginPath();
  ctx.ellipse(43, 54, 1.8, 2.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Galhos e folhas restantes
  circle(ctx, 38, 50, 4, '#3f7a32');
  circle(ctx, 33, 52, 3, '#4d8436');
}

function drawCarry(ctx: Ctx, resource: ResourceType): void {
  switch (resource) {
    case 'wood':
      ctx.fillStyle = '#6e4a2a';
      ctx.fillRect(1, 2, 10, 3);
      ctx.fillRect(1, 6, 10, 3);
      ctx.fillStyle = '#d6b07a';
      ctx.fillRect(10, 2, 2, 3);
      ctx.fillRect(10, 6, 2, 3);
      break;
    case 'food':
      ctx.fillStyle = '#8a5a2e';
      poly(ctx, [[1, 4], [11, 4], [9, 10], [3, 10]]);
      circle(ctx, 4, 4, 2, '#b0243f');
      circle(ctx, 8, 3.5, 2, '#c8402f');
      break;
    case 'gold':
      ctx.fillStyle = '#5a3e05';
      poly(ctx, [[1, 7], [6, 1], [11, 7], [6, 10]]);
      ctx.fillStyle = '#f2c94c';
      poly(ctx, [[2, 7], [6, 2], [10, 7], [6, 9]]);
      break;
    case 'stone':
      ctx.fillStyle = '#5d5a54';
      ctx.fillRect(1, 2, 10, 8);
      ctx.fillStyle = '#b8b2a6';
      ctx.fillRect(2, 3, 8, 6);
      break;
  }
}

function drawMine(ctx: Ctx, rock: string, ore: string | null): void {
  shadow(ctx, 28, 35, 24, 7);
  const blobs: Array<[number, number, number, number]> = [
    [18, 28, 13, 9],
    [36, 29, 12, 8],
    [27, 21, 12, 10],
  ];
  for (const [x, y, rx, ry] of blobs) {
    ctx.fillStyle = shade(rock, -0.35);
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(rock, 0.25);
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ore) {
    const nuggets: Point[] = [
      [16, 26],
      [24, 18],
      [32, 24],
      [38, 30],
      [28, 30],
      [21, 31],
    ];
    for (const [x, y] of nuggets) {
      ctx.fillStyle = shade(ore, -0.3);
      poly(ctx, [[x - 3, y], [x, y - 3], [x + 3, y], [x, y + 2]]);
      ctx.fillStyle = ore;
      poly(ctx, [[x - 2, y - 0.5], [x, y - 2.5], [x + 2, y - 0.5], [x, y + 1]]);
    }
  } else {
    ctx.strokeStyle = shade(rock, -0.4);
    ctx.lineWidth = 1;
    for (const [x, y] of [
      [18, 26],
      [34, 27],
      [26, 19],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y + 1);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 1, y + 4);
      ctx.stroke();
    }
  }
}

function drawBerryBush(ctx: Ctx): void {
  shadow(ctx, 20, 27, 15, 5);
  circle(ctx, 13, 20, 9, '#2f6a2a');
  circle(ctx, 27, 20, 9, '#2f6a2a');
  circle(ctx, 20, 14, 10, '#3b7d33');
  circle(ctx, 17, 11, 5, '#4f9644');
  const berries: Point[] = [
    [12, 18],
    [17, 22],
    [24, 13],
    [28, 21],
    [21, 18],
    [14, 12],
    [31, 16],
  ];
  for (const [x, y] of berries) {
    circle(ctx, x, y, 2, '#8e1f3c');
    circle(ctx, x - 0.6, y - 0.6, 0.8, '#f08aa5');
  }
}

// ---------------------------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------------------------

function drawVillager(ctx: Ctx, playerColor: number): void {
  const color = toCssColor(playerColor);
  shadow(ctx, 13, 35, 8, 3);
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(9, 26, 3, 9);
  ctx.fillRect(14, 26, 3, 9);
  ctx.fillStyle = color;
  poly(ctx, [[7, 27], [8, 15], [18, 15], [19, 27]]);
  ctx.fillStyle = shade(playerColor, -0.3);
  poly(ctx, [[13, 15], [18, 15], [19, 27], [13, 27]]);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(7, 22, 12, 2);
  ctx.fillStyle = '#e0b48c';
  ctx.fillRect(5, 16, 3, 8);
  ctx.fillRect(18, 16, 3, 8);
  circle(ctx, 13, 10, 5, '#e8be96');
  ctx.fillStyle = '#b08a4a';
  poly(ctx, [[6, 9], [13, 3], [20, 9]]);
  // Ferramenta
  ctx.strokeStyle = '#5b3d22';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(21, 24);
  ctx.lineTo(24, 12);
  ctx.stroke();
  ctx.fillStyle = '#9aa0a6';
  poly(ctx, [[22, 12], [26, 11], [25, 14]]);
}

function drawScout(ctx: Ctx, playerColor: number): void {
  const color = toCssColor(playerColor);
  shadow(ctx, 24, 41, 18, 4);
  // Cavalo
  ctx.fillStyle = '#5c3b22';
  for (const x of [14, 18, 30, 34]) ctx.fillRect(x, 28, 3, 13);
  ctx.fillStyle = '#7a4f2c';
  ctx.beginPath();
  ctx.ellipse(24, 26, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  poly(ctx, [[34, 24], [40, 12], [46, 14], [44, 19], [39, 26]]);
  ctx.fillStyle = '#3a2516';
  poly(ctx, [[38, 13], [41, 9], [42, 13]]);
  poly(ctx, [[9, 23], [5, 34], [10, 30], [12, 24]]);
  circle(ctx, 43, 14, 1, '#111');
  // Manta com a cor do jogador
  ctx.fillStyle = color;
  poly(ctx, [[17, 21], [31, 21], [33, 30], [15, 30]]);
  // Cavaleiro
  ctx.fillStyle = shade(playerColor, -0.25);
  ctx.fillRect(20, 9, 8, 13);
  ctx.fillStyle = color;
  ctx.fillRect(20, 9, 4, 13);
  circle(ctx, 24, 6, 4, '#e8be96');
  ctx.fillStyle = '#8c939a';
  poly(ctx, [[19, 5], [24, 0], [29, 5]]);
  // Lança com flâmula
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, 24);
  ctx.lineTo(12, 2);
  ctx.stroke();
  ctx.fillStyle = color;
  poly(ctx, [[12, 3], [5, 6], [13, 8]]);
}

