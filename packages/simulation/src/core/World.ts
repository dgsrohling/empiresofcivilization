import { getBuildingDefinition, getUnitDefinition, RESOURCE_NODE_DEFINITIONS } from '@eoc/game-data';
import { GAIA_PLAYER_ID, type EntityId, type PlayerId } from '@eoc/shared';
import type { BuildingEntity, Entity, PlayerState, ResourceEntity, SimEvent, UnitEntity } from '../entities/types';
import type { GeneratedMap, ResourceNodeSpec } from '../map/types';
import { NavGrid } from '../pathfinding/NavGrid';

/** Estado completo de uma partida. Não conhece renderização nem interface. */
export class World {
  readonly grid: NavGrid;
  readonly entities = new Map<EntityId, Entity>();
  readonly units: UnitEntity[] = [];
  readonly buildings: BuildingEntity[] = [];
  readonly resources: ResourceEntity[] = [];
  readonly players = new Map<PlayerId, PlayerState>();
  /** Entidade estática (edifício/recurso) por tile; 0 = livre. */
  readonly staticAt: Int32Array;
  tick = 0;
  /** Tempo de partida em segundos. */
  time = 0;
  /** Incrementado quando entidades estáticas são criadas ou removidas (minimapa, caches). */
  staticRevision = 0;
  private nextId = 1;
  private events: SimEvent[] = [];

  constructor(readonly map: GeneratedMap) {
    this.grid = new NavGrid(map.width, map.height, map.terrain);
    this.staticAt = new Int32Array(map.width * map.height);
  }

  get width(): number {
    return this.map.width;
  }

  get height(): number {
    return this.map.height;
  }

  addPlayer(player: PlayerState): void {
    this.players.set(player.id, player);
  }

  getPlayer(id: PlayerId): PlayerState | undefined {
    return this.players.get(id);
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  getStaticAtTile(tx: number, ty: number): Entity | undefined {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return undefined;
    const id = this.staticAt[ty * this.width + tx] as number;
    return id ? this.entities.get(id) : undefined;
  }

  addUnit(type: string, owner: PlayerId, x: number, y: number): UnitEntity {
    const def = getUnitDefinition(type);
    const unit: UnitEntity = {
      id: this.nextId++,
      kind: 'unit',
      owner,
      type,
      x,
      y,
      prevX: x,
      prevY: y,
      hp: def.maxHp,
      maxHp: def.maxHp,
      radius: def.radius,
      speed: def.speed,
      state: 'idle',
      task: null,
      buildQueue: [],
      carryType: null,
      carryAmount: 0,
      gatherProgress: 0,
      moveStatus: 'none',
      path: [],
      pathIndex: 0,
      moveGoal: null,
      awaitingPath: false,
      heading: Math.PI / 4,
      stuckTimer: 0,
      stuckCheckX: x,
      stuckCheckY: y,
      repathCount: 0,
    };
    this.entities.set(unit.id, unit);
    this.units.push(unit);
    const player = this.players.get(owner);
    if (player) player.population += def.populationCost;
    return unit;
  }

  /** Cria um edifício. Obras (`complete = false`) começam com 1 de vida e progresso 0. */
  addBuilding(type: string, owner: PlayerId, tileX: number, tileY: number, complete = true): BuildingEntity {
    const def = getBuildingDefinition(type);
    const { w, h } = def.footprint;
    const building: BuildingEntity = {
      id: this.nextId++,
      kind: 'building',
      owner,
      type,
      x: tileX + w / 2,
      y: tileY + h / 2,
      hp: complete ? def.maxHp : 1,
      maxHp: def.maxHp,
      tileX,
      tileY,
      width: w,
      height: h,
      complete,
      buildProgress: complete ? 1 : 0,
    };
    this.entities.set(building.id, building);
    this.buildings.push(building);
    this.occupy(building.id, tileX, tileY, w, h);
    const player = this.players.get(owner);
    if (player && complete) player.populationCap += def.populationProvided;
    return building;
  }

  addResource(spec: ResourceNodeSpec): ResourceEntity {
    const def = RESOURCE_NODE_DEFINITIONS[spec.type];
    const resource: ResourceEntity = {
      id: this.nextId++,
      kind: 'resource',
      owner: GAIA_PLAYER_ID,
      type: spec.type,
      nodeType: spec.type,
      resource: def.resource,
      amount: def.amount,
      initialAmount: def.amount,
      x: spec.x + 0.5,
      y: spec.y + 0.5,
      hp: 1,
      maxHp: 1,
      tileX: spec.x,
      tileY: spec.y,
    };
    this.entities.set(resource.id, resource);
    this.resources.push(resource);
    this.occupy(resource.id, spec.x, spec.y, 1, 1);
    return resource;
  }

  /** Conclui uma obra: vida cheia proporcional ao dano sofrido e aumento do limite populacional. */
  completeBuilding(building: BuildingEntity): void {
    if (building.complete) return;
    building.complete = true;
    building.buildProgress = 1;
    building.hp = Math.min(building.maxHp, Math.max(1, building.hp));
    const player = this.players.get(building.owner);
    if (player) player.populationCap += getBuildingDefinition(building.type).populationProvided;
    this.emit({ type: 'buildingCompleted', id: building.id, playerId: building.owner, buildingType: building.type });
  }

  /** Remove uma entidade do mundo, liberando os tiles que ocupava. */
  removeEntity(id: EntityId): void {
    const entity = this.entities.get(id);
    if (!entity) return;
    this.entities.delete(id);
    if (entity.kind === 'unit') {
      removeFromArray(this.units, entity);
      const player = this.players.get(entity.owner);
      if (player) player.population = Math.max(0, player.population - getUnitDefinition(entity.type).populationCost);
    } else if (entity.kind === 'building') {
      removeFromArray(this.buildings, entity);
      this.release(entity.tileX, entity.tileY, entity.width, entity.height);
      const player = this.players.get(entity.owner);
      if (player && entity.complete) player.populationCap -= getBuildingDefinition(entity.type).populationProvided;
    } else {
      removeFromArray(this.resources, entity);
      this.release(entity.tileX, entity.tileY, 1, 1);
    }
    this.emit({ type: 'entityRemoved', id, kind: entity.kind });
  }

  emit(event: SimEvent): void {
    this.events.push(event);
    // Proteção para execuções sem consumidor (ex.: testes longos, servidor sem clientes).
    if (this.events.length > 10_000) this.events.splice(0, this.events.length - 10_000);
  }

  /** Retorna e esvazia a fila de eventos. */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private release(tx: number, ty: number, w: number, h: number): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.staticAt[y * this.width + x] = 0;
      }
    }
    this.grid.setBlocked(tx, ty, w, h, false);
    this.staticRevision++;
  }

  private occupy(id: EntityId, tx: number, ty: number, w: number, h: number): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.staticAt[y * this.width + x] = id;
      }
    }
    this.grid.setBlocked(tx, ty, w, h, true);
    this.staticRevision++;
  }
}

function removeFromArray<T>(items: T[], item: T): void {
  const i = items.indexOf(item);
  if (i >= 0) items.splice(i, 1);
}
