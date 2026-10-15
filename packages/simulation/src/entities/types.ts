import type { ResourceNodeType } from '@eoc/game-data';
import type { AgeId, EntityId, PlayerId, ResourceAmounts, ResourceType, StanceId, Vec2 } from '@eoc/shared';

/** Atividade visível da unidade (usada por HUD e animações). */
export type UnitState = 'idle' | 'moving' | 'gathering' | 'building' | 'attacking';

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

/**
 * Atacar um alvo. `auto` = alvo encontrado sozinho (respeita a distância máxima de
 * perseguição da postura); ordens explícitas perseguem até o alvo sumir.
 */
export interface AttackTask {
  type: 'attack';
  targetId: EntityId;
  auto: boolean;
  /** Tempo até recalcular a rota de perseguição. */
  repathTimer: number;
}

/** Reparar um edifício próprio danificado. */
export interface RepairTask {
  type: 'repair';
  phase: 'toSite' | 'repairing';
  targetId: EntityId;
  approachAttempts: number;
}

export type UnitTask = GatherTask | BuildTask | AttackTask | RepairTask;

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
  stance: StanceId;
  /** Tempo restante (s) até poder atacar de novo. */
  attackCooldown: number;
  /** Tempo até a próxima busca automática de alvos. */
  scanTimer: number;
  /** Ponto ao qual a unidade volta depois de perseguir um alvo automático. */
  guardX: number;
  guardY: number;
  /** Destino de um ataque-mover em andamento. */
  attackMoveGoal: Vec2 | null;
  /** Tempo de jogo (s) do último dano sofrido (para exibir a barra de vida). */
  lastDamagedAt: number;
  /** Última unidade que causou dano (para revidar). */
  lastAttackerId: EntityId | null;
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
  /** Fila de treinamento (o primeiro item é o que está sendo treinado). */
  queue: TrainingItem[];
  /** Ponto de reunião das unidades treinadas. */
  rallyPoint: { x: number; y: number; targetId: EntityId | null } | null;
  /** Custo de reparo acumulado ainda não cobrado (frações de recurso). */
  repairDebt: ResourceAmounts;
  lastDamagedAt: number;
}

export interface TrainingItem {
  unitType: string;
  /** Segundos de treinamento já realizados. */
  progress: number;
}

/** Projétil em voo (flechas). O dano é calculado no disparo e aplicado se o alvo ainda existir. */
export interface Projectile {
  id: number;
  owner: PlayerId;
  attackerId: EntityId;
  targetId: EntityId;
  damage: number;
  speed: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  startX: number;
  startY: number;
  /** Último ponto conhecido do alvo (o projétil termina ali se o alvo morrer). */
  aimX: number;
  aimY: number;
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
  /** Multiplicador da velocidade de treinamento. */
  trainSpeed: number;
}

export interface PlayerStats {
  /** Total depositado desde o início da partida. */
  gathered: ResourceAmounts;
  unitsTrained: number;
  unitsLost: number;
  kills: number;
  buildingsLost: number;
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
  | { type: 'buildingCancelled'; id: EntityId; playerId: PlayerId; buildingType: string; refund: Partial<ResourceAmounts> }
  | { type: 'entityDied'; id: EntityId; kind: 'unit' | 'building'; entityType: string; owner: PlayerId; killerOwner: PlayerId | null; x: number; y: number }
  | { type: 'attacked'; targetId: EntityId; owner: PlayerId; attackerOwner: PlayerId; x: number; y: number }
  | { type: 'meleeHit'; attackerId: EntityId; targetId: EntityId; x: number; y: number }
  | { type: 'projectileFired'; projectileId: number; attackerId: EntityId }
  | { type: 'projectileHit'; projectileId: number; targetId: EntityId | null; x: number; y: number }
  | { type: 'unitTrained'; id: EntityId; buildingId: EntityId; playerId: PlayerId; unitType: string }
  | { type: 'trainingBlocked'; buildingId: EntityId; playerId: PlayerId; reason: 'population' }
  | { type: 'repairStopped'; buildingId: EntityId; playerId: PlayerId; reason: 'resources' | 'done' };
