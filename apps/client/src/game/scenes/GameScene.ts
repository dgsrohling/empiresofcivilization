import { TICK_MS } from '@eoc/shared';
import type { SimEvent } from '@eoc/simulation';
import Phaser from 'phaser';
import { useHudStore } from '../../stores/hudStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { CameraController } from '../camera/CameraController';
import type { GameSession } from '../GameSession';
import { RESOURCE_NAMES, buildHudSnapshot } from '../hudSnapshot';
import { InputController } from '../input/InputController';
import { PlacementController } from '../input/PlacementController';
import { getBuildingDefinition } from '@eoc/game-data';
import { areEnemies } from '@eoc/simulation';
import { mapScreenBounds, worldToScreen } from '../iso';
import { toCssColor } from '../rendering/color';
import { EntityRenderer } from '../rendering/EntityRenderer';
import { EffectsRenderer } from '../rendering/EffectsRenderer';
import { OverlayRenderer } from '../rendering/OverlayRenderer';
import { generateTextures } from '../rendering/proceduralTextures';
import { TerrainRenderer } from '../rendering/TerrainRenderer';

const HUD_INTERVAL_MS = 200;
/** Evita a "espiral da morte" após a aba ficar em segundo plano. */
const MAX_FRAME_DELTA_MS = 250;
const CAMERA_MARGIN = 256;
const RESOURCE_TEXT_COLORS = { food: 0xff8a7a, wood: 0xe0b07a, gold: 0xf7da7a, stone: 0xd8d2c6 } as const;

/**
 * Cena principal. Avança a simulação em passos fixos (acumulador) e renderiza com
 * interpolação entre ticks, desacoplando a taxa de simulação da taxa de quadros.
 */
export class GameScene extends Phaser.Scene {
  cameraController!: CameraController;
  private terrain!: TerrainRenderer;
  private entities!: EntityRenderer;
  private overlay!: OverlayRenderer;
  private effects!: EffectsRenderer;
  private inputController!: InputController;
  private placement!: PlacementController;
  private accumulator = 0;
  private hudTimer = 0;
  private readonly view = new Phaser.Geom.Rectangle();

  constructor(private readonly session: GameSession) {
    super('game');
  }

  create(): void {
    const world = this.session.sim.world;
    const colors = new Map<number, number>([[0, 0xd8d0b0]]);
    for (const p of world.players.values()) colors.set(p.id, p.color);
    generateTextures(this, colors);

    this.terrain = new TerrainRenderer(this, world.map);
    this.entities = new EntityRenderer(this, world);
    this.overlay = new OverlayRenderer(this, world, this.entities);
    this.effects = new EffectsRenderer(this, world);

    const cam = this.cameras.main;
    const bounds = mapScreenBounds(world.width, world.height);
    cam.setBounds(bounds.x - CAMERA_MARGIN, bounds.y - CAMERA_MARGIN, bounds.width + CAMERA_MARGIN * 2, bounds.height + CAMERA_MARGIN * 2);
    const tc = world.buildings.find((b) => b.owner === this.session.localPlayerId);
    if (tc) {
      const p = worldToScreen(tc.x, tc.y);
      cam.centerOn(p.x, p.y + 60);
    }

    this.cameraController = new CameraController(
      this,
      () => useSettingsStore.getState(),
      (code) => (code === 'KeyS' && this.hasOwnSelection()) || ((code === 'KeyA' || code === 'KeyH') && this.session.ownFighterIds().length > 0),
    );
    this.placement = new PlacementController(this, this.session);
    this.inputController = new InputController(this, this.session, this.entities, this.overlay, this.placement);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    this.session.attachScene(this);
    this.publishHud();
  }

  override update(_time: number, delta: number): void {
    const now = this.time.now;
    this.cameraController.update(delta);

    if (!this.session.paused) {
      this.accumulator += Math.min(delta, MAX_FRAME_DELTA_MS) * this.session.timeScale;
      while (this.accumulator >= TICK_MS) {
        this.session.sim.step();
        this.accumulator -= TICK_MS;
      }
    }
    const alpha = this.accumulator / TICK_MS;
    this.handleEvents(this.session.sim.drainEvents());

    const wv = this.cameras.main.worldView;
    this.view.setTo(wv.x - 96, wv.y - 96, wv.width + 192, wv.height + 256);
    this.terrain.cull(this.view);
    this.entities.update(alpha, now, this.view);
    this.effects.update(alpha, this.view);
    this.placement.update();
    this.inputController.update();

    const settings = useSettingsStore.getState();
    this.overlay.draw({
      selection: this.session.selection.current,
      hoverId: this.inputController.hoverId,
      dragRect: this.inputController.dragRect,
      showPaths: settings.showPaths,
      localPlayerId: this.session.localPlayerId,
      alpha,
      zoom: this.cameras.main.zoom,
      timeMs: now,
      worldTime: this.session.sim.world.time,
    });

    this.hudTimer += delta;
    if (this.hudTimer >= HUD_INTERVAL_MS) {
      this.hudTimer = 0;
      this.publishHud();
    }
  }

  private handleEvents(events: SimEvent[]): void {
    if (events.length === 0) return;
    this.entities.applyEvents(events);
    this.effects.applyEvents(events, this.view);
    const local = this.session.localPlayerId;
    for (const e of events) {
      if (e.type === 'deposited' && e.playerId === local) {
        this.session.depositRates.record(this.session.sim.world.time, e.resource, e.amount);
        this.floatingText(e.unitId, `+${e.amount}`, RESOURCE_TEXT_COLORS[e.resource]);
      } else if (e.type === 'buildingCompleted' && e.playerId === local) {
        this.session.notify(`${getBuildingDefinition(e.buildingType).name} concluído(a)`);
      } else if (e.type === 'buildingCancelled' && e.playerId === local) {
        const refund = Object.entries(e.refund)
          .map(([r, n]) => `${n} de ${RESOURCE_NAMES[r as keyof typeof RESOURCE_NAMES]}`)
          .join(', ');
        this.session.notify(refund ? `Obra cancelada — devolvido: ${refund}` : 'Obra cancelada');
      } else if (e.type === 'attacked' && e.owner === local && areEnemies(local, e.attackerOwner)) {
        this.session.reportAttack(e.x, e.y);
      } else if (e.type === 'entityDied' && e.owner === local && e.kind === 'building') {
        this.session.notify(`${getBuildingDefinition(e.entityType).name} destruído(a)!`);
      } else if (e.type === 'trainingBlocked' && e.playerId === local) {
        this.session.notify('População máxima atingida — construa mais casas');
      } else if (e.type === 'repairStopped' && e.playerId === local && e.reason === 'resources') {
        this.session.notify('Recursos insuficientes para continuar o reparo');
      } else if (e.type === 'noDropsite' && e.playerId === local) {
        this.session.notify(`Nenhum depósito disponível para ${RESOURCE_NAMES[e.resource]}`);
      }
    }
  }

  /** Texto flutuante breve acima de uma entidade (ex.: "+10" ao depositar). */
  private floatingText(entityId: number, text: string, color: number): void {
    const sprite = this.entities.getSprite(entityId);
    if (!sprite || !sprite.visible) return;
    const label = this.add
      .text(sprite.x, sprite.y - sprite.displayHeight * sprite.originY - 4, text, {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: toCssColor(color),
        stroke: '#1a0f08',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(1e9 + 1);
    this.tweens.add({ targets: label, y: label.y - 26, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
  }

  private hasOwnSelection(): boolean {
    const world = this.session.sim.world;
    return this.session.selection.current.some((id) => {
      const e = world.getEntity(id);
      return e?.kind === 'unit' && e.owner === this.session.localPlayerId;
    });
  }

  private publishHud(): void {
    const world = this.session.sim.world;
    this.session.selection.prune((id) => world.entities.has(id));
    const rates = this.session.depositRates.ratePerMinute(world.time);
    const snapshot = buildHudSnapshot(world, this.session.selection.current, this.session.localPlayerId, rates);
    useHudStore.getState().setSnapshot(snapshot, Math.round(this.game.loop.actualFps));
  }

  private onResize(size: Phaser.Structs.Size): void {
    this.cameras.resize(size.width, size.height);
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.cameraController?.destroy();
    this.inputController?.destroy();
    this.placement?.destroy();
  }
}
