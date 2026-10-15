import type { EntityId, Vec2 } from '@eoc/shared';
import type { Entity, World } from '@eoc/simulation';
import Phaser from 'phaser';
import { TILE_H, TILE_W, worldToScreen } from '../iso';
import type { EntityRenderer } from './EntityRenderer';

interface Marker {
  x: number;
  y: number;
  start: number;
  color: number;
}

interface Flash {
  id: EntityId;
  start: number;
}

const MARKER_DURATION = 650;
const FLASH_DURATION = 900;
const COLOR_TARGET = 0xffd65a;
const COLOR_OWN = 0x7cf08c;
const COLOR_ENEMY = 0xff5a4a;
const COLOR_NEUTRAL = 0xf2e6b0;
const COLOR_PATH = 0xfff3c0;

export interface OverlayState {
  selection: readonly EntityId[];
  hoverId: EntityId | null;
  dragRect: Phaser.Geom.Rectangle | null;
  showPaths: boolean;
  localPlayerId: number;
  alpha: number;
  zoom: number;
  timeMs: number;
}

/** Indicadores visuais: seleção, vida, destino, caminho e retângulo de seleção. */
export class OverlayRenderer {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly top: Phaser.GameObjects.Graphics;
  private readonly markers: Marker[] = [];
  private readonly flashes: Flash[] = [];
  private readonly p: Vec2 = { x: 0, y: 0 };

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly entities: EntityRenderer,
  ) {
    this.ground = scene.add.graphics().setDepth(-1e8);
    this.top = scene.add.graphics().setDepth(1e9);
  }

  addMarker(screenX: number, screenY: number, ok: boolean, timeMs: number): void {
    this.markers.push({ x: screenX, y: screenY, start: timeMs, color: ok ? COLOR_OWN : COLOR_ENEMY });
    if (this.markers.length > 8) this.markers.shift();
  }

  /** Destaca brevemente uma entidade (alvo de coleta ou depósito). */
  flashEntity(id: EntityId, timeMs: number): void {
    this.flashes.push({ id, start: timeMs });
    if (this.flashes.length > 8) this.flashes.shift();
  }

  draw(state: OverlayState): void {
    const g = this.ground;
    const t = this.top;
    g.clear();
    t.clear();
    const lw = Math.max(1, 1.6 / state.zoom);

    // Obras: fundação no chão e barra de progresso (sempre visíveis).
    for (const b of this.world.buildings) {
      if (b.complete) continue;
      const pts = [worldToScreen(b.tileX, b.tileY), worldToScreen(b.tileX + b.width, b.tileY), worldToScreen(b.tileX + b.width, b.tileY + b.height), worldToScreen(b.tileX, b.tileY + b.height)];
      g.fillStyle(0x6b4a2a, 0.45);
      g.fillPoints(pts, true);
      g.lineStyle(lw, 0x3d2814, 0.8);
      g.strokePoints(pts, true);
      if (b.owner === state.localPlayerId) this.drawProgressBar(t, b.id, b.buildProgress, lw);
    }

    if (state.hoverId !== null && !state.selection.includes(state.hoverId)) {
      const e = this.world.getEntity(state.hoverId);
      if (e) this.drawFootprint(g, e, 0xffffff, 0.45, lw, state.alpha);
    }

    for (const id of state.selection) {
      const e = this.world.getEntity(id);
      if (!e) continue;
      const color = e.owner === state.localPlayerId ? COLOR_OWN : e.owner === 0 ? COLOR_NEUTRAL : COLOR_ENEMY;
      this.drawFootprint(g, e, color, 0.95, lw * 1.3, state.alpha);
      if (e.kind !== 'resource') this.drawHealthBar(t, e, state.alpha, lw);
      if (state.showPaths && e.kind === 'unit' && e.owner === state.localPlayerId && e.moveGoal) this.drawPath(g, e.id, state.alpha, lw);
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]!;
      const k = (state.timeMs - f.start) / FLASH_DURATION;
      const e = this.world.getEntity(f.id);
      if (k >= 1 || !e) {
        this.flashes.splice(i, 1);
        continue;
      }
      // Pisca três vezes enquanto desvanece.
      if (Math.floor(k * 6) % 2 === 0) this.drawFootprint(g, e, COLOR_TARGET, 1 - k * 0.6, lw * 1.6, state.alpha);
    }

    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i]!;
      const k = (state.timeMs - m.start) / MARKER_DURATION;
      if (k >= 1) {
        this.markers.splice(i, 1);
        continue;
      }
      const r = 14 * (1 - k) + 4;
      g.lineStyle(lw * 1.5, m.color, 1 - k);
      g.strokeEllipse(m.x, m.y, r * 2, r);
      g.lineStyle(lw, m.color, 1 - k);
      g.lineBetween(m.x - 4, m.y, m.x + 4, m.y);
      g.lineBetween(m.x, m.y - 2, m.x, m.y + 2);
    }

    if (state.dragRect) {
      const r = state.dragRect;
      t.fillStyle(COLOR_OWN, 0.1);
      t.fillRect(r.x, r.y, r.width, r.height);
      t.lineStyle(lw, COLOR_OWN, 0.9);
      t.strokeRect(r.x, r.y, r.width, r.height);
    }
  }

  private drawFootprint(g: Phaser.GameObjects.Graphics, e: Entity, color: number, alpha: number, lw: number, interp: number): void {
    if (e.kind === 'unit') {
      const p = this.entities.unitScreenPosition(e, interp, this.p);
      const rx = (e.radius + 0.12) * TILE_W * 0.72;
      g.lineStyle(lw, color, alpha);
      g.strokeEllipse(p.x, p.y, rx * 2, rx);
      return;
    }
    const tx = e.tileX;
    const ty = e.tileY;
    const w = e.kind === 'building' ? e.width : 1;
    const h = e.kind === 'building' ? e.height : 1;
    const a = worldToScreen(tx, ty);
    const b = worldToScreen(tx + w, ty);
    const c = worldToScreen(tx + w, ty + h);
    const d = worldToScreen(tx, ty + h);
    g.lineStyle(lw, color, alpha);
    g.strokePoints([a, b, c, d], true, true);
  }

  private drawHealthBar(t: Phaser.GameObjects.Graphics, e: Entity, alpha: number, lw: number): void {
    const sprite = this.entities.getSprite(e.id);
    let x: number;
    let y: number;
    let width: number;
    if (sprite) {
      x = sprite.x;
      y = sprite.y - sprite.displayHeight * sprite.originY - 6;
      width = e.kind === 'building' ? 90 : 28;
    } else {
      const p = e.kind === 'unit' ? this.entities.unitScreenPosition(e, alpha, this.p) : worldToScreen(e.x, e.y, this.p);
      x = p.x;
      y = p.y - TILE_H;
      width = 28;
    }
    const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
    const h = 4;
    t.fillStyle(0x1a0f08, 0.85);
    t.fillRect(x - width / 2 - 1, y - 1, width + 2, h + 2);
    t.fillStyle(ratio > 0.5 ? 0x4ccf5a : ratio > 0.25 ? 0xe0b030 : 0xd8402f, 1);
    t.fillRect(x - width / 2, y, width * ratio, h);
    t.lineStyle(lw * 0.6, 0x000000, 0.6);
    t.strokeRect(x - width / 2 - 1, y - 1, width + 2, h + 2);
  }

  private drawProgressBar(t: Phaser.GameObjects.Graphics, id: EntityId, progress: number, lw: number): void {
    const sprite = this.entities.getSprite(id);
    if (!sprite || !sprite.visible) return;
    const width = 70;
    const x = sprite.x - width / 2;
    const y = sprite.y - sprite.displayHeight * sprite.originY + 4;
    t.fillStyle(0x1a0f08, 0.85);
    t.fillRect(x - 1, y - 1, width + 2, 7);
    t.fillStyle(0xe0b44c, 1);
    t.fillRect(x, y, width * progress, 5);
    t.lineStyle(lw * 0.6, 0x000000, 0.6);
    t.strokeRect(x - 1, y - 1, width + 2, 7);
  }

  private drawPath(g: Phaser.GameObjects.Graphics, id: EntityId, alpha: number, lw: number): void {
    const unit = this.world.getEntity(id);
    if (!unit || unit.kind !== 'unit' || unit.pathIndex >= unit.path.length) return;
    const start = this.entities.unitScreenPosition(unit, alpha, { x: 0, y: 0 });
    const points: Vec2[] = [start];
    for (let i = unit.pathIndex; i < unit.path.length; i++) {
      const wp = unit.path[i]!;
      points.push(worldToScreen(wp.x, wp.y));
    }
    g.lineStyle(lw, COLOR_PATH, 0.45);
    g.strokePoints(points, false, false);
    const end = points[points.length - 1]!;
    g.fillStyle(COLOR_PATH, 0.7);
    g.fillEllipse(end.x, end.y, 7, 3.5);
  }
}
