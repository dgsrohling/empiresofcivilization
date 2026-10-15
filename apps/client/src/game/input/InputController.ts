import { getBuildingDefinition, getUnitDefinition } from '@eoc/game-data';
import type { EntityId, Vec2 } from '@eoc/shared';
import { acceptsResource, areEnemies, type Entity, type UnitEntity } from '@eoc/simulation';
import Phaser from 'phaser';
import { isTypingTarget } from '../camera/CameraController';
import type { GameSession } from '../GameSession';
import { screenToWorld } from '../iso';
import type { EntityRenderer } from '../rendering/EntityRenderer';
import type { OverlayRenderer } from '../rendering/OverlayRenderer';
import { useHudStore } from '../../stores/hudStore';
import { TRAIN_HOTKEYS } from '../hudSnapshot';
import type { PlacementController } from './PlacementController';

const DRAG_THRESHOLD = 6;
const DOUBLE_CLICK_MS = 350;
const DOUBLE_TAP_MS = 400;

/**
 * Traduz mouse e teclado em seleção (estado de interface) e comandos (enviados à simulação).
 * Nunca altera a simulação diretamente.
 */
export class InputController {
  hoverId: EntityId | null = null;
  dragRect: Phaser.Geom.Rectangle | null = null;
  private leftDown = false;
  private downScreen: Vec2 = { x: 0, y: 0 };
  private downWorld: Vec2 = { x: 0, y: 0 };
  private lastClick = { id: -1 as EntityId, time: 0 };
  private lastGroupTap = { slot: -1, time: 0 };
  private readonly tmp: Vec2 = { x: 0, y: 0 };
  private cursor = 'default';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly entities: EntityRenderer,
    private readonly overlay: OverlayRenderer,
    private readonly placement: PlacementController,
  ) {
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.on('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }

  /** Atualiza o destaque de entidade sob o cursor (chamado a cada frame). */
  update(): void {
    const pointer = this.scene.input.activePointer;
    if (this.session.paused || !pointer.active || this.leftDown || this.placement.active) {
      this.hoverId = null;
      this.setCursor('default');
      return;
    }
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hovered = this.pick(wp.x, wp.y);
    this.hoverId = hovered?.id ?? null;
    if (useHudStore.getState().attackMoveArmed) return this.setCursor('crosshair');
    const action = hovered ? this.contextAction(hovered) : 'move';
    this.setCursor(action === 'attack' ? 'crosshair' : action === 'move' || action === 'rally' ? 'default' : 'pointer');
  }

  private setCursor(cursor: string): void {
    if (cursor === this.cursor) return;
    this.cursor = cursor;
    this.scene.input.setDefaultCursor(cursor);
  }

  /** Ação que o clique direito executaria sobre a entidade, dada a seleção atual. */
  private contextAction(target: Entity): 'attack' | 'gather' | 'deposit' | 'construct' | 'repair' | 'rally' | 'move' {
    const own = this.ownSelectedUnits();
    const local = this.session.localPlayerId;
    if (own.length === 0) return this.session.selectedOwnBuilding() && this.trainsUnits() ? 'rally' : 'move';
    if ((target.kind === 'unit' || target.kind === 'building') && areEnemies(local, target.owner) && own.some(canAttack)) return 'attack';
    if (target.kind === 'building' && target.owner === local && !target.complete && own.some(isBuilder)) return 'construct';
    if (target.kind === 'building' && target.owner === local && target.complete && target.hp < target.maxHp && own.some(isBuilder)) return 'repair';
    const gatherers = own.filter(isGatherer);
    if (gatherers.length === 0) return 'move';
    if (target.kind === 'resource' && target.amount > 0) return 'gather';
    if (
      target.kind === 'building' &&
      target.owner === this.session.localPlayerId &&
      gatherers.some((u) => u.carryType && u.carryAmount > 0 && acceptsResource(target, u.carryType))
    )
      return 'deposit';
    return 'move';
  }

  private get world() {
    return this.session.sim.world;
  }

  private isOwnUnit(e: Entity | undefined): e is UnitEntity {
    return !!e && e.kind === 'unit' && e.owner === this.session.localPlayerId;
  }

  private ownSelectedUnits(): UnitEntity[] {
    const out: UnitEntity[] = [];
    for (const id of this.session.selection.current) {
      const e = this.world.getEntity(id);
      if (this.isOwnUnit(e)) out.push(e);
    }
    return out;
  }

  // -------------------------------------------------------------------------------- mouse

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.session.paused) return;
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (this.placement.active) {
      if (pointer.leftButtonDown()) this.placement.confirm(pointer.event.shiftKey);
      else if (pointer.rightButtonDown()) this.session.cancelPlacement();
      return;
    }
    if (useHudStore.getState().attackMoveArmed) {
      if (pointer.leftButtonDown()) this.issueAttackMove(wp.x, wp.y);
      this.session.disarmAttackMove();
      return;
    }
    if (pointer.leftButtonDown()) {
      this.leftDown = true;
      this.downScreen = { x: pointer.x, y: pointer.y };
      this.downWorld = { x: wp.x, y: wp.y };
      this.dragRect = null;
    } else if (pointer.rightButtonDown()) {
      this.issueContextCommand(wp.x, wp.y);
    }
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.leftDown) return;
    if (!this.dragRect && Math.hypot(pointer.x - this.downScreen.x, pointer.y - this.downScreen.y) < DRAG_THRESHOLD) return;
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const x = Math.min(this.downWorld.x, wp.x);
    const y = Math.min(this.downWorld.y, wp.y);
    this.dragRect = new Phaser.Geom.Rectangle(x, y, Math.abs(wp.x - this.downWorld.x), Math.abs(wp.y - this.downWorld.y));
  };

  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.leftDown || pointer.leftButtonDown()) return;
    this.leftDown = false;
    const shift = pointer.event.shiftKey;
    if (this.dragRect) {
      this.boxSelect(this.dragRect, shift);
      this.dragRect = null;
      return;
    }
    const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.clickSelect(wp.x, wp.y, shift);
  };

  private clickSelect(px: number, py: number, shift: boolean): void {
    const selection = this.session.selection;
    const entity = this.pick(px, py);
    if (!entity) {
      if (!shift) selection.clear();
      return;
    }
    const now = performance.now();
    const isDouble = this.lastClick.id === entity.id && now - this.lastClick.time < DOUBLE_CLICK_MS;
    this.lastClick = { id: entity.id, time: now };

    if (isDouble && this.isOwnUnit(entity)) {
      const view = this.scene.cameras.main.worldView;
      const sameType = this.world.units.filter((u) => {
        if (u.owner !== entity.owner || u.type !== entity.type) return false;
        const sprite = this.entities.getSprite(u.id);
        return !!sprite && sprite.visible && view.contains(sprite.x, sprite.y);
      });
      selection.set(sameType.map((u) => u.id));
      return;
    }

    const allOwnUnits = selection.current.every((id) => this.isOwnUnit(this.world.getEntity(id)));
    if (shift && this.isOwnUnit(entity) && allOwnUnits) selection.toggle(entity.id);
    else selection.set([entity.id]);
  }

  private boxSelect(rect: Phaser.Geom.Rectangle, shift: boolean): void {
    const ids: EntityId[] = [];
    for (const u of this.world.units) {
      if (u.owner !== this.session.localPlayerId) continue;
      const sprite = this.entities.getSprite(u.id);
      if (sprite && rect.contains(sprite.x, sprite.y)) ids.push(u.id);
    }
    const selection = this.session.selection;
    const allOwnUnits = selection.current.every((id) => this.isOwnUnit(this.world.getEntity(id)));
    if (shift && allOwnUnits) selection.add(ids);
    else if (ids.length > 0 || !shift) selection.set(ids);
  }

  /**
   * Clique direito contextual: recurso → aldeões coletam; depósito próprio → aldeões com carga
   * depositam; qualquer outro caso → mover. Unidades que não participam da ação apenas se movem.
   */
  private issueContextCommand(px: number, py: number): void {
    const now = this.scene.time.now;
    const target = this.pick(px, py);
    const point = screenToWorld(px, py, { x: 0, y: 0 });
    const units = this.ownSelectedUnits();
    if (units.length === 0) {
      // Edifício que treina unidades: define o ponto de reunião.
      const building = this.session.selectedOwnBuilding();
      if (!building || !this.trainsUnits()) return;
      const targetId = target?.kind === 'resource' ? target.id : undefined;
      const result = this.session.issue({ type: 'setRallyPoint', buildingId: building.id, target: point, targetId });
      if (result.ok) this.overlay.addMarker(px, py, true, now);
      else this.session.notify(result.reason);
      return;
    }
    const action = target ? this.contextAction(target) : 'move';
    let movers = units;

    if (target && action === 'attack') {
      const fighters = units.filter(canAttack);
      const result = this.session.issue({ type: 'attack', unitIds: fighters.map((u) => u.id), targetId: target.id });
      if (result.ok) this.overlay.flashEntity(target.id, now, true);
      else this.session.notify(result.reason);
      movers = units.filter((u) => !canAttack(u));
    } else if (target && action === 'repair') {
      const builders = units.filter(isBuilder);
      const result = this.session.issue({ type: 'repair', unitIds: builders.map((u) => u.id), buildingId: target.id });
      if (result.ok) this.overlay.flashEntity(target.id, now);
      else this.session.notify(result.reason);
      movers = units.filter((u) => !isBuilder(u));
    } else if (target && action === 'gather') {
      const gatherers = units.filter(isGatherer);
      const result = this.session.issue({ type: 'gather', unitIds: gatherers.map((u) => u.id), targetId: target.id });
      if (result.ok) this.overlay.flashEntity(target.id, now);
      else this.session.notify(result.reason);
      movers = units.filter((u) => !isGatherer(u));
    } else if (target && action === 'construct') {
      const builders = units.filter(isBuilder);
      const result = this.session.issue({ type: 'construct', unitIds: builders.map((u) => u.id), buildingId: target.id });
      if (result.ok) this.overlay.flashEntity(target.id, now);
      else this.session.notify(result.reason);
      movers = units.filter((u) => !isBuilder(u));
    } else if (target && action === 'deposit' && target.kind === 'building') {
      const carriers = units.filter((u) => isGatherer(u) && u.carryType && u.carryAmount > 0 && acceptsResource(target, u.carryType));
      const result = this.session.issue({ type: 'deposit', unitIds: carriers.map((u) => u.id), dropsiteId: target.id });
      if (result.ok) this.overlay.flashEntity(target.id, now);
      else this.session.notify(result.reason);
      movers = units.filter((u) => !carriers.includes(u));
    }

    if (movers.length === 0) return;
    const result = this.session.issue({ type: 'move', unitIds: movers.map((u) => u.id), target: point });
    this.overlay.addMarker(px, py, result.ok, now);
    if (!result.ok) this.session.notify(result.reason);
  }

  private issueAttackMove(px: number, py: number): void {
    const ids = this.session.ownFighterIds();
    if (ids.length === 0) return;
    const result = this.session.issue({ type: 'attackMove', unitIds: ids, target: screenToWorld(px, py, { x: 0, y: 0 }) });
    this.overlay.addMarker(px, py, result.ok, this.scene.time.now, true);
    if (!result.ok) this.session.notify(result.reason);
  }

  private trainsUnits(): boolean {
    const b = this.session.selectedOwnBuilding();
    return !!b && b.complete && getBuildingDefinition(b.type).trains.length > 0;
  }

  /**
   * Entidade sob um ponto de tela (pixels de mundo). Unidades têm prioridade;
   * depois edifícios e recursos cujos sprites contenham o ponto; por fim, o tile.
   */
  pick(px: number, py: number): Entity | undefined {
    let best: Entity | undefined;
    let bestDepth = -Infinity;
    for (const u of this.world.units) {
      const s = this.entities.getSprite(u.id);
      if (!s || !s.visible) continue;
      const w = s.displayWidth * 0.75;
      const top = s.y - s.displayHeight * s.originY;
      const bottom = s.y + 4;
      if (px >= s.x - w / 2 && px <= s.x + w / 2 && py >= top && py <= bottom && s.depth > bestDepth) {
        best = u;
        bestDepth = s.depth;
      }
    }
    if (best) return best;

    const tile = screenToWorld(px, py, this.tmp);
    const tx = Math.floor(tile.x);
    const ty = Math.floor(tile.y);
    // Sprites altos (árvores, edifícios) podem cobrir tiles "atrás" do cursor.
    for (let dy = 0; dy <= 3; dy++) {
      for (let dx = 0; dx <= 3; dx++) {
        const e = this.world.getStaticAtTile(tx + dx, ty + dy);
        if (!e) continue;
        const s = this.entities.getSprite(e.id);
        if (!s) continue;
        const left = s.x - s.displayWidth * s.originX;
        const top = s.y - s.displayHeight * s.originY;
        const inset = e.kind === 'building' ? 0.1 : 0.2;
        if (
          px >= left + s.displayWidth * inset &&
          px <= left + s.displayWidth * (1 - inset) &&
          py >= top &&
          py <= top + s.displayHeight &&
          s.depth > bestDepth
        ) {
          best = e;
          bestDepth = s.depth;
        }
      }
    }
    return best ?? this.world.getStaticAtTile(tx, ty);
  }

  // -------------------------------------------------------------------------------- teclado

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target) || this.session.paused) return;
    const selection = this.session.selection;

    if (e.code === 'Escape') {
      const hud = useHudStore.getState();
      if (this.placement.active) return this.session.cancelPlacement();
      if (hud.attackMoveArmed) return this.session.disarmAttackMove();
      if (hud.buildMenuOpen) return hud.setBuildMenuOpen(false);
      selection.clear();
      this.dragRect = null;
      this.leftDown = false;
      return;
    }
    if (e.code === 'KeyS' && !e.ctrlKey && this.ownSelectedUnits().length > 0) {
      this.session.stopSelected();
      return;
    }
    if (e.code === 'KeyB' && !e.ctrlKey) {
      this.session.toggleBuildMenu();
      return;
    }
    if (useHudStore.getState().buildMenuOpen && /^Key[A-Z]$/.test(e.code)) {
      const option = useHudStore.getState().snapshot?.selection.buildOptions.find((o) => `Key${o.hotkey}` === e.code);
      if (option) {
        e.preventDefault();
        this.session.beginPlacement(option.type);
        return;
      }
    }
    if (e.code === 'KeyA' && !e.ctrlKey && this.session.ownFighterIds().length > 0) {
      this.session.armAttackMove();
      return;
    }
    if (e.code === 'KeyH' && !e.ctrlKey && this.session.ownFighterIds().length > 0) {
      const stance = useHudStore.getState().snapshot?.selection.stance;
      this.session.setStance(stance === 'holdPosition' ? 'aggressive' : 'holdPosition');
      return;
    }
    const building = this.session.selectedOwnBuilding();
    if (building && !useHudStore.getState().buildMenuOpen) {
      const index = TRAIN_HOTKEYS.findIndex((k) => `Key${k}` === e.code);
      const unitType = index >= 0 ? getBuildingDefinition(building.type).trains[index] : undefined;
      if (unitType) {
        this.session.train(unitType);
        return;
      }
    }
    if (e.code === 'Delete') {
      this.session.cancelSelectedConstruction();
      return;
    }
    if (e.code === 'Period') {
      this.session.selectNextIdleVillager();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      this.session.centerOnSelection();
      return;
    }
    const digit = /^Digit([0-9])$/.exec(e.code);
    if (digit) {
      const slot = Number(digit[1]);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const own = this.ownSelectedUnits().map((u) => u.id);
        selection.assignGroup(slot, own);
        this.session.notify(own.length > 0 ? `Grupo ${slot} definido (${own.length})` : `Grupo ${slot} limpo`);
        return;
      }
      const group = selection.getGroup(slot);
      if (group.length === 0) return;
      const now = performance.now();
      const doubleTap = this.lastGroupTap.slot === slot && now - this.lastGroupTap.time < DOUBLE_TAP_MS;
      this.lastGroupTap = { slot, time: now };
      selection.set(group);
      if (doubleTap) this.session.centerOnSelection();
    }
  };
}

function isGatherer(unit: UnitEntity): boolean {
  return !!getUnitDefinition(unit.type).gatherer;
}

function isBuilder(unit: UnitEntity): boolean {
  return !!getUnitDefinition(unit.type).builder;
}

function canAttack(unit: UnitEntity): boolean {
  return getUnitDefinition(unit.type).attack > 0;
}
