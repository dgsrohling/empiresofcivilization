import { MAP_SIZES, type CommandResult, type GameCommand, type MapSizeId, type PlayerId, type StanceId, type Vec2 } from '@eoc/shared';
import { PLAYER_COLORS, getBuildingDefinition, getUnitDefinition } from '@eoc/game-data';
import { checkBuildingAvailability, checkPlacement, createMatch, findNearestDropsite, type Simulation } from '@eoc/simulation';
import Phaser from 'phaser';
import { useHudStore } from '../stores/hudStore';
import { DepositRateTracker } from './DepositRateTracker';
import { worldToScreen } from './iso';
import { GameScene } from './scenes/GameScene';
import { SelectionModel } from './selection/SelectionModel';

export interface SessionOptions {
  seed: number;
  mapSize: MapSizeId;
  sandbox?: boolean;
}

export interface MinimapPing {
  x: number;
  y: number;
  time: number;
}

/** Intervalo mínimo (s de jogo) entre alertas de ataque. */
const ATTACK_ALERT_INTERVAL = 15;

/**
 * Ponte entre a interface React e o jogo (Phaser + simulação).
 * O React chama métodos de alto nível; nunca manipula sprites ou entidades diretamente.
 */
export class GameSession {
  readonly sim: Simulation;
  /** Jogador controlado nesta máquina (alterna no modo de teste). */
  localPlayerId: PlayerId = 1;
  /** Alertas recentes de ataque (mostrados no minimapa). */
  readonly pings: MinimapPing[] = [];
  private lastAttackAlert = -Infinity;
  readonly selection = new SelectionModel();
  paused = false;
  /** Multiplicador de velocidade da simulação (1 = normal). */
  timeScale = 1;
  readonly depositRates = new DepositRateTracker();
  /** Edifício sendo posicionado (modo de posicionamento ativo). */
  placement: { type: string } | null = null;
  private readonly game: Phaser.Game;
  private scene: GameScene | null = null;
  private readonly iconCache = new Map<string, string>();

  constructor(parent: HTMLElement, readonly options: SessionOptions) {
    this.sim = createMatch({
      seed: options.seed,
      mapSize: MAP_SIZES[options.mapSize],
      players: [
        { id: 1, name: 'Reino de Valdoria', color: PLAYER_COLORS[1]!, isHuman: true },
        { id: 2, name: 'Império de Arkan', color: PLAYER_COLORS[2]!, isHuman: false },
      ],
    });
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#0d1216',
      disableContextMenu: true,
      banner: false,
      scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 1280, height: parent.clientHeight || 720 },
      render: { antialias: true, powerPreference: 'high-performance' },
      input: { mouse: { preventDefaultWheel: true } },
      scene: [new GameScene(this)],
    });
  }

  attachScene(scene: GameScene): void {
    this.scene = scene;
  }

  issue(command: GameCommand): CommandResult {
    return this.sim.issue(this.localPlayerId, command);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  notify(text: string): void {
    useHudStore.getState().notify(text);
  }

  private ownSelectedUnitIds(): number[] {
    const world = this.sim.world;
    return this.selection.current.filter((id) => {
      const e = world.getEntity(id);
      return e?.kind === 'unit' && e.owner === this.localPlayerId;
    });
  }

  /** Unidades próprias selecionadas que podem atacar. */
  ownFighterIds(): number[] {
    const world = this.sim.world;
    return this.selection.current.filter((id) => {
      const e = world.getEntity(id);
      return e?.kind === 'unit' && e.owner === this.localPlayerId && getUnitDefinition(e.type).attack > 0 && getUnitDefinition(e.type).autoAttack;
    });
  }

  armAttackMove(): void {
    if (this.ownFighterIds().length === 0) return;
    this.cancelPlacement();
    useHudStore.getState().setAttackMoveArmed(true);
  }

  disarmAttackMove(): void {
    useHudStore.getState().setAttackMoveArmed(false);
  }

  setStance(stance: StanceId): void {
    const ids = this.ownFighterIds();
    if (ids.length > 0) this.issue({ type: 'setStance', unitIds: ids, stance });
  }

  /** Edifício próprio selecionado (um só) — alvo dos botões de treinamento. */
  selectedOwnBuilding() {
    if (this.selection.current.length !== 1) return null;
    const e = this.sim.world.getEntity(this.selection.current[0]!);
    return e?.kind === 'building' && e.owner === this.localPlayerId ? e : null;
  }

  train(unitType: string): void {
    const b = this.selectedOwnBuilding();
    if (!b) return;
    const result = this.issue({ type: 'train', buildingId: b.id, unitType });
    if (!result.ok) this.notify(result.reason);
  }

  cancelTrain(index: number): void {
    const b = this.selectedOwnBuilding();
    if (b) this.issue({ type: 'cancelTrain', buildingId: b.id, index });
  }

  /** Registra um ataque sofrido: alerta (com intervalo mínimo) e marca no minimapa. */
  reportAttack(x: number, y: number): void {
    const now = this.sim.world.time;
    this.pings.push({ x, y, time: now });
    if (this.pings.length > 12) this.pings.shift();
    if (now - this.lastAttackAlert >= ATTACK_ALERT_INTERVAL) {
      this.lastAttackAlert = now;
      this.notify('Você está sendo atacado!');
    }
  }

  /** Modo de teste: passa o controle para o outro jogador. */
  switchPlayer(): void {
    if (!this.options.sandbox) return;
    const ids = [...this.sim.world.players.keys()].sort((a, b) => a - b);
    const next = ids[(ids.indexOf(this.localPlayerId) + 1) % ids.length]!;
    this.localPlayerId = next;
    this.selection.clear();
    this.cancelPlacement();
    this.disarmAttackMove();
    useHudStore.getState().setBuildMenuOpen(false);
    const tc = this.sim.world.buildings.find((b) => b.owner === next);
    if (tc) {
      const p = worldToScreen(tc.x, tc.y);
      this.centerOnScreenPoint(p.x, p.y + 60);
    }
    this.notify(`Controlando: ${this.sim.world.getPlayer(next)?.name ?? next}`);
  }

  /** Aldeões (construtores) próprios na seleção atual. */
  ownBuilderIds(): number[] {
    const world = this.sim.world;
    return this.selection.current.filter((id) => {
      const e = world.getEntity(id);
      return e?.kind === 'unit' && e.owner === this.localPlayerId && !!getUnitDefinition(e.type).builder;
    });
  }

  hasOwnBuilders(): boolean {
    return this.ownBuilderIds().length > 0;
  }

  /** Entra no modo de posicionamento, se houver construtores selecionados e o edifício estiver disponível. */
  beginPlacement(type: string): void {
    if (!this.hasOwnBuilders()) return;
    const check = checkBuildingAvailability(this.sim.world, this.localPlayerId, type);
    if (!check.ok) {
      this.notify(check.reason);
      return;
    }
    this.placement = { type };
    useHudStore.getState().setPlacing(getBuildingDefinition(type).name);
    useHudStore.getState().setBuildMenuOpen(false);
  }

  cancelPlacement(): void {
    this.placement = null;
    useHudStore.getState().setPlacing(null);
  }

  /** O edifício pode ser posicionado com o canto superior esquerdo em (tileX, tileY)? */
  canPlace(type: string, tileX: number, tileY: number): boolean {
    return checkPlacement(this.sim.world, this.localPlayerId, type, tileX, tileY).ok;
  }

  placeBuilding(type: string, tileX: number, tileY: number, queue: boolean): CommandResult {
    return this.issue({ type: 'placeBuilding', unitIds: this.ownBuilderIds(), buildingType: type, tileX, tileY, queue });
  }

  toggleBuildMenu(): void {
    const hud = useHudStore.getState();
    if (!this.hasOwnBuilders()) return hud.setBuildMenuOpen(false);
    hud.setBuildMenuOpen(!hud.buildMenuOpen);
  }

  /** Cancela a obra selecionada (edifício próprio não concluído). */
  cancelSelectedConstruction(): void {
    const world = this.sim.world;
    for (const id of this.selection.current) {
      const e = world.getEntity(id);
      if (e?.kind !== 'building' || e.owner !== this.localPlayerId || e.complete) continue;
      const result = this.issue({ type: 'cancelBuilding', buildingId: e.id });
      if (!result.ok) this.notify(result.reason);
    }
  }

  stopSelected(): void {
    const ids = this.ownSelectedUnitIds();
    if (ids.length > 0) this.issue({ type: 'stop', unitIds: ids });
  }

  /** Envia os aldeões selecionados com carga ao depósito mais próximo de cada um. */
  depositSelected(): void {
    const world = this.sim.world;
    for (const id of this.ownSelectedUnitIds()) {
      const u = world.getEntity(id);
      if (u?.kind !== 'unit' || !u.carryType || u.carryAmount <= 0) continue;
      const dropsite = findNearestDropsite(world, this.localPlayerId, u.carryType, u.x, u.y);
      if (!dropsite) {
        this.notify('Nenhum depósito disponível para esse recurso');
        continue;
      }
      this.issue({ type: 'deposit', unitIds: [u.id], dropsiteId: dropsite.id });
    }
  }

  /** Seleciona o próximo aldeão ocioso (em ordem cíclica) e centraliza a câmera nele. */
  selectNextIdleVillager(): void {
    const idle = this.sim.world.units
      .filter((u) => u.owner === this.localPlayerId && u.state === 'idle' && !u.task && getUnitDefinition(u.type).gatherer)
      .sort((a, b) => a.id - b.id);
    if (idle.length === 0) {
      this.notify('Nenhum aldeão ocioso');
      return;
    }
    const current = this.selection.current.length === 1 ? this.selection.current[0]! : -1;
    const next = idle.find((u) => u.id > current) ?? idle[0]!;
    this.selection.set([next.id]);
    this.centerOnSelection();
  }

  /** Mantém na seleção apenas as entidades de um tipo. */
  selectOnlyType(type: string): void {
    const world = this.sim.world;
    this.selection.set(this.selection.current.filter((id) => world.getEntity(id)?.type === type));
  }

  centerOnSelection(): void {
    const world = this.sim.world;
    const entities = this.selection.current.map((id) => world.getEntity(id)).filter((e) => !!e);
    if (entities.length === 0 || !this.scene) return;
    const cx = entities.reduce((s, e) => s + e.x, 0) / entities.length;
    const cy = entities.reduce((s, e) => s + e.y, 0) / entities.length;
    const p = worldToScreen(cx, cy);
    this.scene.cameraController.centerOn(p.x, p.y);
  }

  /** Área visível da câmera, em pixels de mundo (para o minimapa). */
  getViewRect(): { x: number; y: number; width: number; height: number } | null {
    if (!this.scene) return null;
    const v = this.scene.cameras.main.worldView;
    return { x: v.x, y: v.y, width: v.width, height: v.height };
  }

  centerOnScreenPoint(x: number, y: number): void {
    this.scene?.cameraController.centerOn(x, y);
  }

  getIconUrl(textureKey: string): string | undefined {
    const cached = this.iconCache.get(textureKey);
    if (cached) return cached;
    if (!this.scene || !this.scene.textures.exists(textureKey)) return undefined;
    const url = this.scene.textures.getBase64(textureKey);
    if (typeof url === 'string' && url.startsWith('data:')) this.iconCache.set(textureKey, url);
    return url as string;
  }

  /** Converte coordenada de mundo (tiles) em coordenada de cliente (CSS px). Usado nos testes E2E. */
  worldToClient(wx: number, wy: number): Vec2 | null {
    if (!this.scene) return null;
    const cam = this.scene.cameras.main;
    const p = worldToScreen(wx, wy);
    const rect = this.game.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.game.scale.width;
    const scaleY = rect.height / this.game.scale.height;
    return {
      x: rect.left + (p.x - cam.worldView.x) * cam.zoom * scaleX,
      y: rect.top + (p.y - cam.worldView.y) * cam.zoom * scaleY,
    };
  }

  destroy(): void {
    this.scene = null;
    this.game.destroy(true);
  }
}
