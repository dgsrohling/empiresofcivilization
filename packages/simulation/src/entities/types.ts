import type { ResourceNodeType } from '@eoc/game-data';
import type { AgeId, EntityId, PlayerId, ResourceAmounts, ResourceType, Vec2 } from '@eoc/shared';

/** Atividade visível da unidade (usada por HUD e animações). */
export type UnitState = 'idle' | 'moving' | 'gathering' | 'building';

/** Situação do deslocamento atual, lida pelos sistemas que dão ordens à unidade. */
export type MoveStatus = 'none' | 'moving' | 'arrived' | 'failed';

export type GatherPhase = 'toResource' | 'gathering' | 'toDropsite';

/**
 * Ciclo econômico: ir ao recurso → coletar até encher → levar ao depósito → voltar.
 * `targetId` nulo significa "apenas depositar e ficar ocioso".
 */
export interface GatherTask {
  type: 'gather';
  phase: GatherPhase;
  targetId: EntityId | null;
  nodeType: ResourceNodeType | null;
  /** Última posição conhecida do alvo (centro de busca de uma nova fonte). */
  lastX: number;
  lastY: number;
  dropsiteId: EntityId | null;
  approachAttempts: number;
}

/** Ir até uma obra e trabalhar nela até concluí-la. */
export interface BuildTask {
  type: 'build';
  phase: 'toSite' | 'building';
  targetId: EntityId;
  approachAttempts: number;
}

export type UnitTask = GatherTask | BuildTask;

interface EntityBase {
  id: EntityId;
  owner: PlayerId;
  type: string;
  /** Posição atual em coordenadas de mundo (tiles). Para estáticos, é o centro da área ocupada. */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface UnitEntity extends EntityBase {
  kind: 'unit';
  /** Posição no início do tick atual, usada pela renderização para interpolar. */
  prevX: number;
  prevY: number;
  radius: number;
  speed: number;
  state: UnitState;
  task: UnitTask | null;
  /** Obras a construir depois da atual (Shift ao posicionar). */
  buildQueue: EntityId[];
  /** Recurso carregado (aldeões). */
  carryType: ResourceType | null;
  carryAmount: number;
  /** Fração acumulada da próxima unidade de recurso. */
  gatherProgress: number;
  // --- movimento ---
  moveStatus: MoveStatus;
  /** Waypoints restantes (coordenadas de mundo). */
  path: Vec2[];
  pathIndex: number;
  moveGoal: Vec2 | null;
  awaitingPath: boolean;
  /** Direção do último deslocamento, em radianos (espaço de mundo). */
  heading: number;
  stuckTimer: number;
  stuckCheckX: number;
  stuckCheckY: number;
  repathCount: number;
}

export interface BuildingEntity extends EntityBase {
  kind: 'building';
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  complete: boolean;
  /** Progresso da obra em [0, 1]. */
  buildProgress: number;
}

export interface ResourceEntity extends EntityBase {
  kind: 'resource';
  nodeType: ResourceNodeType;
  resource: ResourceType;
  amount: number;
  initialAmount: number;
  tileX: number;
  tileY: number;
}

export type Entity = UnitEntity | BuildingEntity | ResourceEntity;

export interface PlayerModifiers {
  /** Multiplicador de velocidade de coleta por recurso (tecnologias, civilização). */
  gatherRate: ResourceAmounts;
  /** Bônus somado à capacidade de carga dos aldeões. */
  carryCapacity: number;
  /** Multiplicador da velocidade de construção. */
  buildSpeed: number;
}

export interface PlayerStats {
  /** Total depositado desde o início da partida. */
  gathered: ResourceAmounts;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  color: number;
  isHuman: boolean;
  resources: ResourceAmounts;
  population: number;
  populationCap: number;
  age: AgeId;
  modifiers: PlayerModifiers;
  stats: PlayerStats;
}

/** Eventos emitidos pela simulação para interface, áudio e rede. */
export type SimEvent =
  | { type: 'entityRemoved'; id: EntityId; kind: Entity['kind'] }
  | { type: 'resourceTouched'; id: EntityId }
  | { type: 'deposited'; playerId: PlayerId; unitId: EntityId; dropsiteId: EntityId; resource: ResourceType; amount: number }
  | { type: 'noDropsite'; playerId: PlayerId; unitId: EntityId; resource: ResourceType }
  | { type: 'buildingPlaced'; id: EntityId; playerId: PlayerId; buildingType: string }
  | { type: 'buildingCompleted'; id: EntityId; playerId: PlayerId; buildingType: string }
  | { type: 'buildingCancelled'; id: EntityId; playerId: PlayerId; buildingType: string; refund: Partial<ResourceAmounts> };
