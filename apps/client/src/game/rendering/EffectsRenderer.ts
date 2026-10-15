import { getBuildingDefinition } from '@eoc/game-data';
import type { Vec2 } from '@eoc/shared';
import type { SimEvent, World } from '@eoc/simulation';
import Phaser from 'phaser';
import { worldToScreen } from '../iso';
import { unitOrigin } from './proceduralTextures';
import { ARROW_TEXTURE, rubbleTexture, unitTexture } from './textureKeys';

const CORPSE_FADE_DELAY = 1500;
const CORPSE_FADE = 2500;
const RUBBLE_LIFETIME = 25_000;
/** Altura máxima (px de tela) do arco das flechas. */
const ARROW_ARC = 26;

/**
 * Efeitos de combate desacoplados das entidades: flechas em voo (interpoladas, em arco),
 * impactos, corpos que tombam e somem, e escombros de edifícios destruídos.
 */
export class EffectsRenderer {
  private readonly arrows = new Map<number, Phaser.GameObjects.Image>();
  private readonly a: Vec2 = { x: 0, y: 0 };
  private readonly b: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {}

  update(alpha: number, view: Phaser.Geom.Rectangle): void {
    const seen = new Set<number>();
    for (const p of this.world.projectiles) {
      seen.add(p.id);
      let sprite = this.arrows.get(p.id);
      if (!sprite) {
        sprite = this.scene.add.image(0, 0, ARROW_TEXTURE).setOrigin(0.5, 0.5);
        this.arrows.set(p.id, sprite);
      }
      const x = p.prevX + (p.x - p.prevX) * alpha;
      const y = p.prevY + (p.y - p.prevY) * alpha;
      const total = Math.max(0.01, Math.hypot(p.aimX - p.startX, p.aimY - p.startY));
      const t = Math.min(1, Math.hypot(x - p.startX, y - p.startY) / total);
      const arc = Math.min(ARROW_ARC, total * 6);
      const here = worldToScreen(x, y, this.a);
      const hy = here.y - Math.sin(Math.PI * t) * arc;
      // Direção: posição um pouco à frente na mesma trajetória.
      const ahead = Math.min(1, t + 0.05);
      const fx = p.startX + (p.aimX - p.startX) * ahead;
      const fy = p.startY + (p.aimY - p.startY) * ahead;
      const next = worldToScreen(fx, fy, this.b);
      const ny = next.y - Math.sin(Math.PI * ahead) * arc;
      sprite.setPosition(here.x, hy).setRotation(Math.atan2(ny - hy, next.x - here.x)).setDepth(here.y + 1).setVisible(view.contains(here.x, here.y));
    }
    for (const [id, sprite] of this.arrows) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.arrows.delete(id);
      }
    }
  }

  applyEvents(events: readonly SimEvent[], view: Phaser.Geom.Rectangle): void {
    for (const e of events) {
      switch (e.type) {
        case 'meleeHit':
          this.impact(e.x, e.y, 0xfff0c0, view);
          break;
        case 'projectileHit':
          if (e.targetId !== null) this.impact(e.x, e.y, 0xe8d8b0, view);
          break;
        case 'entityDied':
          if (e.kind === 'unit') this.corpse(e.entityType, e.owner, e.x, e.y);
          else this.rubble(e.entityType, e.x, e.y);
          break;
      }
    }
  }

  private impact(wx: number, wy: number, color: number, view: Phaser.Geom.Rectangle): void {
    const p = worldToScreen(wx, wy, this.a);
    if (!view.contains(p.x, p.y)) return;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.8;
      const dot = this.scene.add.circle(p.x, p.y - 14, 1.6, color, 0.95).setDepth(p.y + 2);
      this.scene.tweens.add({
        targets: dot,
        x: p.x + Math.cos(angle) * 9,
        y: p.y - 14 + Math.sin(angle) * 6,
        alpha: 0,
        duration: 260,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private corpse(type: string, owner: number, wx: number, wy: number): void {
    const p = worldToScreen(wx, wy, this.a);
    const origin = unitOrigin(type);
    const sprite = this.scene.add
      .image(p.x, p.y, unitTexture(type, owner))
      .setOrigin(origin.x, origin.y)
      .setDepth(p.y - 0.5)
      .setTint(0xb0a090);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.scene.tweens.add({ targets: sprite, angle: 82 * dir, y: p.y + 2, duration: 380, ease: 'Quad.easeIn' });
    this.scene.tweens.add({ targets: sprite, alpha: 0, delay: CORPSE_FADE_DELAY, duration: CORPSE_FADE, onComplete: () => sprite.destroy() });
  }

  private rubble(type: string, wx: number, wy: number): void {
    const p = worldToScreen(wx, wy, this.a);
    let n = 2;
    try {
      n = Math.min(4, Math.max(2, getBuildingDefinition(type).footprint.w));
    } catch {
      /* tipo desconhecido: usa o padrão */
    }
    const rubble = this.scene.add.image(p.x, p.y, rubbleTexture(n)).setDepth(-1e7);
    this.scene.tweens.add({ targets: rubble, alpha: 0, delay: RUBBLE_LIFETIME - 3000, duration: 3000, onComplete: () => rubble.destroy() });
    // Nuvem de poeira.
    for (let i = 0; i < 10; i++) {
      const puff = this.scene.add
        .circle(p.x + (Math.random() - 0.5) * n * 40, p.y + (Math.random() - 0.5) * n * 16, 8 + Math.random() * 10, 0x9a8a72, 0.6)
        .setDepth(p.y + 50);
      this.scene.tweens.add({
        targets: puff,
        y: puff.y - 20 - Math.random() * 20,
        scale: 1.8,
        alpha: 0,
        duration: 900 + Math.random() * 600,
        onComplete: () => puff.destroy(),
      });
    }
  }
}
