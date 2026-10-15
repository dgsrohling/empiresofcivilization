import type { EntityId, Vec2 } from '@eoc/shared';
import type { BuildingEntity, Entity, SimEvent, UnitEntity, World } from '@eoc/simulation';
import Phaser from 'phaser';
import { worldToScreen } from '../iso';
import { ORIGINS, buildingOrigin, unitOrigin } from './proceduralTextures';
import { FELLED_TREE_TEXTURE, TREE_VARIANTS, buildingTexture, carryTexture, resourceTexture, unitTexture } from './textureKeys';

const STATIC_CHUNK = 16;

/**
 * Sincroniza sprites com as entidades da simulação. Posições de unidades são
 * interpoladas entre o tick anterior e o atual (movimento suave a qualquer FPS).
 * Profundidade = coordenada Y de tela do ponto de apoio (ordenação isométrica).
 */
export class EntityRenderer {
  private readonly unitSprites = new Map<EntityId, Phaser.GameObjects.Image>();
  private readonly carrySprites = new Map<EntityId, Phaser.GameObjects.Image>();
  private readonly staticSprites = new Map<EntityId, Phaser.GameObjects.Image>();
  private readonly staticChunkOf = new Map<EntityId, number>();
  private readonly staticChunks: Phaser.GameObjects.Image[][] = [];
  private readonly chunkBounds: Phaser.Geom.Rectangle[] = [];
  private readonly chunkCols: number;
  private readonly tmp: Vec2 = { x: 0, y: 0 };
  /** Obras em andamento (sprite recortado conforme o progresso). */
  private readonly incomplete = new Set<EntityId>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: World,
  ) {
    this.chunkCols = Math.ceil(world.width / STATIC_CHUNK);
    const rows = Math.ceil(world.height / STATIC_CHUNK);
    for (let i = 0; i < this.chunkCols * rows; i++) {
      this.staticChunks.push([]);
      this.chunkBounds.push(new Phaser.Geom.Rectangle());
    }
    for (const r of world.resources) {
      const variant = r.nodeType === 'tree' ? hash(r.tileX, r.tileY) % TREE_VARIANTS : 0;
      const texture = r.nodeType === 'tree' && r.amount < r.initialAmount ? FELLED_TREE_TEXTURE : resourceTexture(r.nodeType, variant);
      this.addStatic(r, texture, ORIGINS[r.nodeType], r.x, r.y);
    }
    for (const b of world.buildings) this.addBuilding(b);
  }

  private addBuilding(b: BuildingEntity): void {
    this.addStatic(b, buildingTexture(b.type, b.owner), buildingOrigin(b.type), b.x, b.y);
    if (!b.complete) this.incomplete.add(b.id);
  }

  getSprite(id: EntityId): Phaser.GameObjects.Image | undefined {
    return this.unitSprites.get(id) ?? this.staticSprites.get(id);
  }

  /** Posição de tela interpolada de uma unidade. */
  unitScreenPosition(unit: UnitEntity, alpha: number, out: Vec2): Vec2 {
    const x = unit.prevX + (unit.x - unit.prevX) * alpha;
    const y = unit.prevY + (unit.y - unit.prevY) * alpha;
    return worldToScreen(x, y, out);
  }

  /** Aplica mudanças discretas vindas da simulação (remoções, árvores derrubadas). */
  applyEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'entityRemoved') {
        this.removeSprite(event.id);
        this.incomplete.delete(event.id);
      } else if (event.type === 'buildingPlaced') {
        const b = this.world.getEntity(event.id);
        if (b?.kind === 'building' && !this.staticSprites.has(b.id)) this.addBuilding(b);
      } else if (event.type === 'resourceTouched') {
        const e = this.world.getEntity(event.id);
        if (e?.kind === 'resource' && e.nodeType === 'tree') this.staticSprites.get(e.id)?.setTexture(FELLED_TREE_TEXTURE);
      }
    }
  }

  update(alpha: number, timeMs: number, view: Phaser.Geom.Rectangle): void {
    this.updateConstructionSites();
    for (let i = 0; i < this.staticChunks.length; i++) {
      const visible = Phaser.Geom.Intersects.RectangleToRectangle(this.chunkBounds[i]!, view);
      const chunk = this.staticChunks[i]!;
      if (chunk.length > 0 && chunk[0]!.visible !== visible) for (const s of chunk) s.setVisible(visible);
    }

    const p = this.tmp;
    for (const unit of this.world.units) {
      let sprite = this.unitSprites.get(unit.id);
      if (!sprite) {
        const origin = unitOrigin(unit.type);
        sprite = this.scene.add.image(0, 0, unitTexture(unit.type, unit.owner)).setOrigin(origin.x, origin.y);
        this.unitSprites.set(unit.id, sprite);
      }
      this.unitScreenPosition(unit, alpha, p);
      const visible = view.contains(p.x, p.y) || view.contains(p.x, p.y - 40);
      sprite.setVisible(visible);
      this.updateCarry(unit, sprite, visible);
      if (!visible) continue;

      const moving = unit.moveGoal !== null;
      const bob = moving ? -Math.abs(Math.sin(timeMs * 0.012 + unit.id)) * 2 : 0;
      sprite.setPosition(p.x, p.y + bob);
      sprite.setDepth(p.y);
      // Coleta/obra: balanço do corpo, como se usasse a ferramenta. Ataque: investida rápida.
      if (unit.state === 'gathering' || unit.state === 'building') sprite.setAngle(Math.sin(timeMs * 0.014 + unit.id) * 11);
      else if (unit.state === 'attacking') sprite.setAngle(Math.sin(timeMs * 0.022 + unit.id) * 14 * (sprite.flipX ? -1 : 1));
      else sprite.setAngle(0);
      const screenDx = Math.cos(unit.heading) - Math.sin(unit.heading);
      if (Math.abs(screenDx) > 0.05) sprite.setFlipX(screenDx < 0);
      const carry = this.carrySprites.get(unit.id);
      if (carry?.visible) carry.setPosition(p.x + (sprite.flipX ? 6 : -6), p.y + bob - 15).setDepth(p.y + 0.01);
    }

    if (this.unitSprites.size > this.world.units.length) this.removeStaleUnits();
  }

  /**
   * Obras "sobem" de baixo para cima: o sprite é recortado mostrando a parte inferior
   * proporcional ao progresso, semitransparente até a conclusão.
   */
  private updateConstructionSites(): void {
    for (const id of this.incomplete) {
      const b = this.world.getEntity(id);
      const sprite = this.staticSprites.get(id);
      if (!b || b.kind !== 'building' || !sprite) {
        this.incomplete.delete(id);
        continue;
      }
      if (b.complete) {
        sprite.setCrop().setAlpha(1);
        this.incomplete.delete(id);
        continue;
      }
      const shown = 0.12 + 0.88 * b.buildProgress;
      const h = sprite.height;
      sprite.setCrop(0, h * (1 - shown), sprite.width, h * shown).setAlpha(0.55 + 0.35 * b.buildProgress);
    }
  }

  private updateCarry(unit: UnitEntity, sprite: Phaser.GameObjects.Image, visible: boolean): void {
    let carry = this.carrySprites.get(unit.id);
    const show = visible && unit.carryAmount > 0 && unit.carryType !== null;
    if (!show) {
      carry?.setVisible(false);
      return;
    }
    const texture = carryTexture(unit.carryType!);
    if (!carry) {
      carry = this.scene.add.image(sprite.x, sprite.y, texture).setOrigin(0.5, 1);
      this.carrySprites.set(unit.id, carry);
    } else if (carry.texture.key !== texture) {
      carry.setTexture(texture);
    }
    carry.setVisible(true);
  }

  private removeStaleUnits(): void {
    for (const id of this.unitSprites.keys()) {
      if (!this.world.getEntity(id)) this.removeSprite(id);
    }
  }

  private removeSprite(id: EntityId): void {
    const unitSprite = this.unitSprites.get(id);
    if (unitSprite) {
      unitSprite.destroy();
      this.unitSprites.delete(id);
      this.carrySprites.get(id)?.destroy();
      this.carrySprites.delete(id);
      return;
    }
    const sprite = this.staticSprites.get(id);
    if (!sprite) return;
    const chunkIndex = this.staticChunkOf.get(id);
    if (chunkIndex !== undefined) {
      const chunk = this.staticChunks[chunkIndex]!;
      const i = chunk.indexOf(sprite);
      if (i >= 0) chunk.splice(i, 1);
    }
    sprite.destroy();
    this.staticSprites.delete(id);
    this.staticChunkOf.delete(id);
  }

  private addStatic(entity: Entity, texture: string, origin: { x: number; y: number }, wx: number, wy: number): void {
    const p = worldToScreen(wx, wy, this.tmp);
    const sprite = this.scene.add.image(p.x, p.y, texture).setOrigin(origin.x, origin.y).setDepth(p.y);
    this.staticSprites.set(entity.id, sprite);
    const cx = Math.min(this.chunkCols - 1, Math.floor(wx / STATIC_CHUNK));
    const cy = Math.floor(wy / STATIC_CHUNK);
    const index = cy * this.chunkCols + cx;
    const chunk = this.staticChunks[index]!;
    const bounds = this.chunkBounds[index]!;
    const sb = sprite.getBounds();
    if (chunk.length === 0) bounds.setTo(sb.x, sb.y, sb.width, sb.height);
    else Phaser.Geom.Rectangle.Union(bounds, sb, bounds);
    chunk.push(sprite);
    this.staticChunkOf.set(entity.id, index);
  }
}

function hash(x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 12)) >>> 0;
}
