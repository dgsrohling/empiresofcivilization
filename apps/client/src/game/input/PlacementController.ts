import { getBuildingDefinition } from '@eoc/game-data';
import type { Vec2 } from '@eoc/shared';
import { checkPlacement } from '@eoc/simulation';
import Phaser from 'phaser';
import type { GameSession } from '../GameSession';
import { screenToWorld, worldToScreen } from '../iso';
import { buildingOrigin } from '../rendering/proceduralTextures';
import { buildingTexture } from '../rendering/textureKeys';

const COLOR_VALID = 0x5ee07a;
const COLOR_INVALID = 0xff4a3a;

/**
 * Prévia de posicionamento: edifício semitransparente preso à grade sob o cursor, com cada
 * tile da área pintado de verde (livre) ou vermelho (bloqueado). A validação é a mesma
 * função usada pela simulação, então o que aparece verde é exatamente o que será aceito.
 */
export class PlacementController {
  private readonly ghost: Phaser.GameObjects.Image;
  private readonly tiles: Phaser.GameObjects.Graphics;
  private anchor: { x: number; y: number } | null = null;
  private lastType: string | null = null;
  private readonly tmp: Vec2 = { x: 0, y: 0 };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
  ) {
    this.ghost = scene.add.image(0, 0, '__WHITE').setVisible(false).setAlpha(0.65);
    this.tiles = scene.add.graphics().setDepth(-1e8 + 1);
  }

  get active(): boolean {
    return this.session.placement !== null;
  }

  update(): void {
    const placement = this.session.placement;
    this.tiles.clear();
    if (!placement || !this.session.hasOwnBuilders()) {
      if (placement) this.session.cancelPlacement();
      this.ghost.setVisible(false);
      this.anchor = null;
      return;
    }
    const type = placement.type;
    const def = getBuildingDefinition(type);
    const pointer = this.scene.input.activePointer;
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const world = screenToWorld(wp.x, wp.y, this.tmp);
    const { w, h } = def.footprint;
    const tx = Math.round(world.x - w / 2);
    const ty = Math.round(world.y - h / 2);
    this.anchor = { x: tx, y: ty };

    if (this.lastType !== type) {
      const origin = buildingOrigin(type);
      this.ghost.setTexture(buildingTexture(type, this.session.localPlayerId)).setOrigin(origin.x, origin.y);
      this.lastType = type;
    }
    const check = checkPlacement(this.session.sim.world, this.session.localPlayerId, type, tx, ty);
    const center = worldToScreen(tx + w / 2, ty + h / 2, this.tmp);
    this.ghost.setPosition(center.x, center.y).setDepth(center.y).setVisible(true);
    if (check.ok) this.ghost.clearTint();
    else this.ghost.setTint(0xff8070);

    const mapWidth = this.session.sim.world.width;
    const invalid = new Set(check.invalidTiles);
    const zoom = this.scene.cameras.main.zoom;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        const inside = x >= 0 && y >= 0 && x < mapWidth && y < this.session.sim.world.height;
        const bad = !inside || invalid.has(y * mapWidth + x);
        const color = bad ? COLOR_INVALID : COLOR_VALID;
        const pts = [worldToScreen(x, y), worldToScreen(x + 1, y), worldToScreen(x + 1, y + 1), worldToScreen(x, y + 1)];
        this.tiles.fillStyle(color, 0.35);
        this.tiles.fillPoints(pts, true);
        this.tiles.lineStyle(1 / zoom, color, 0.8);
        this.tiles.strokePoints(pts, true);
      }
    }
  }

  /** Confirma a posição atual. Com Shift, mantém o modo de posicionamento e enfileira a obra. */
  confirm(shift: boolean): void {
    const placement = this.session.placement;
    if (!placement || !this.anchor) return;
    const result = this.session.placeBuilding(placement.type, this.anchor.x, this.anchor.y, shift);
    if (!result.ok) {
      this.session.notify(result.reason);
      return;
    }
    if (!shift) this.session.cancelPlacement();
  }

  destroy(): void {
    this.ghost.destroy();
    this.tiles.destroy();
  }
}
