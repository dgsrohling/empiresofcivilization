import type { EntityId, PlayerId, Vec2 } from './types';

/** Ordena que unidades se desloquem até um ponto do mapa. */
export interface MoveCommand {
  type: 'move';
  unitIds: EntityId[];
  target: Vec2;
}

/** Interrompe a ação atual das unidades. */
export interface StopCommand {
  type: 'stop';
  unitIds: EntityId[];
}

/** Ordena que aldeões coletem de uma fonte de recurso (ciclo automático coleta → depósito). */
export interface GatherCommand {
  type: 'gather';
  unitIds: EntityId[];
  targetId: EntityId;
}

/** Ordena que aldeões levem a carga atual a um depósito específico. */
export interface DepositCommand {
  type: 'deposit';
  unitIds: EntityId[];
  dropsiteId: EntityId;
}

/**
 * Posiciona a fundação de um edifício (área a partir do tile superior esquerdo) e envia os
 * aldeões para construí-la. Com `queue`, a obra entra na fila dos aldeões em vez de substituir a ordem atual.
 */
export interface PlaceBuildingCommand {
  type: 'placeBuilding';
  unitIds: EntityId[];
  buildingType: string;
  tileX: number;
  tileY: number;
  queue?: boolean;
}

/** Envia aldeões para trabalhar em uma obra existente. */
export interface ConstructCommand {
  type: 'construct';
  unitIds: EntityId[];
  buildingId: EntityId;
}

/** Cancela uma obra não concluída, devolvendo a parte proporcional do custo. */
export interface CancelBuildingCommand {
  type: 'cancelBuilding';
  buildingId: EntityId;
}

export type GameCommand =
  | MoveCommand
  | StopCommand
  | GatherCommand
  | DepositCommand
  | PlaceBuildingCommand
  | ConstructCommand
  | CancelBuildingCommand;

/** Comando já associado ao jogador que o emitiu. */
export interface IssuedCommand {
  playerId: PlayerId;
  command: GameCommand;
}

export type CommandResult = { ok: true } | { ok: false; reason: string };
