import { TICK_DT, type CommandResult, type GameCommand, type IssuedCommand, type PlayerId } from '@eoc/shared';
import { CombatSystem } from '../combat/CombatSystem';
import { isCombatTarget } from '../combat/damage';
import { resolveUnits, validateCommand } from '../commands/CommandProcessor';
import { ConstructionSystem } from '../construction/ConstructionSystem';
import { EconomySystem } from '../economy/EconomySystem';
import type { SimEvent, UnitEntity } from '../entities/types';
import { distributeDestinations } from '../movement/formation';
import { MovementSystem } from '../movement/MovementSystem';
import { PathService } from '../pathfinding/PathService';
import { TrainingSystem } from '../training/TrainingSystem';
import type { World } from './World';

/**
 * Simulação de passo fixo. Comandos emitidos entram em uma fila e só são aplicados
 * no início do próximo tick, o que mantém a execução determinística e permite rodar
 * a mesma lógica no navegador e no servidor.
 */
export class Simulation {
  readonly paths: PathService;
  readonly movement: MovementSystem;
  readonly economy: EconomySystem;
  readonly construction: ConstructionSystem;
  readonly training: TrainingSystem;
  readonly combat: CombatSystem;
  private queue: IssuedCommand[] = [];

  constructor(readonly world: World) {
    this.paths = new PathService(world.grid);
    this.movement = new MovementSystem(world, this.paths);
    this.economy = new EconomySystem(world, this.movement);
    this.construction = new ConstructionSystem(world, this.movement, this.economy);
    this.training = new TrainingSystem(world, this.movement, this.economy);
    this.combat = new CombatSystem(world, this.movement);
  }

  /** Eventos acumulados desde a última chamada (consumidos pela interface ou pela rede). */
  drainEvents(): SimEvent[] {
    return this.world.drainEvents();
  }

  /** Valida e enfileira um comando. A validação é repetida ao aplicar (o estado pode ter mudado). */
  issue(playerId: PlayerId, command: GameCommand): CommandResult {
    const result = validateCommand(this.world, playerId, command);
    if (result.ok) this.queue.push({ playerId, command });
    return result;
  }

  /** Avança a simulação em exatamente um tick (TICK_DT segundos). */
  step(): void {
    const world = this.world;
    for (const unit of world.units) {
      unit.prevX = unit.x;
      unit.prevY = unit.y;
    }
    const commands = this.queue;
    this.queue = [];
    for (const issued of commands) this.apply(issued);

    this.training.update(TICK_DT);
    this.movement.update(TICK_DT);
    this.economy.update(TICK_DT);
    this.construction.update(TICK_DT);
    this.combat.update(TICK_DT);
    this.settleIdleUnits();
    world.tick++;
    world.time = world.tick * TICK_DT;
  }

  private apply({ playerId, command }: IssuedCommand): void {
    if (!validateCommand(this.world, playerId, command).ok) return;
    const world = this.world;

    // Comandos sobre edifícios.
    switch (command.type) {
      case 'cancelBuilding': {
        const site = world.getEntity(command.buildingId);
        if (site?.kind === 'building') this.construction.cancel(site);
        return;
      }
      case 'train': {
        const b = world.getEntity(command.buildingId);
        if (b?.kind === 'building') this.training.enqueue(b, command.unitType);
        return;
      }
      case 'cancelTrain': {
        const b = world.getEntity(command.buildingId);
        if (b?.kind === 'building') this.training.cancel(b, command.index);
        return;
      }
      case 'setRallyPoint': {
        const b = world.getEntity(command.buildingId);
        if (b?.kind === 'building') this.training.setRallyPoint(b, command.target, command.targetId ?? null);
        return;
      }
    }

    // Comandos sobre unidades.
    const units = resolveUnits(world, command.unitIds);
    if (command.type === 'setStance') {
      for (const unit of units) {
        unit.stance = command.stance;
        unit.guardX = unit.x;
        unit.guardY = unit.y;
      }
      return;
    }
    const keepsQueue = command.type === 'placeBuilding' && command.queue === true;
    for (const unit of units) {
      if (!keepsQueue) unit.buildQueue = [];
      unit.attackMoveGoal = null;
    }
    switch (command.type) {
      case 'move': {
        for (const unit of units) {
          unit.task = null;
          unit.state = 'moving';
        }
        const target = this.clampToMap(command.target);
        const goals = distributeDestinations(world.grid, target, units);
        units.forEach((unit, i) => this.movement.moveUnit(unit, goals[i]!));
        break;
      }
      case 'attackMove': {
        const target = this.clampToMap(command.target);
        const goals = distributeDestinations(world.grid, target, units);
        units.forEach((unit, i) => this.combat.startAttackMove(unit, goals[i]!));
        break;
      }
      case 'stop':
        for (const unit of units) this.stopUnit(unit);
        break;
      case 'attack': {
        const target = world.getEntity(command.targetId);
        if (isCombatTarget(target)) for (const unit of units) this.combat.startAttack(unit, target);
        break;
      }
      case 'gather': {
        const target = world.getEntity(command.targetId);
        if (target?.kind === 'resource') for (const unit of units) this.economy.startGather(unit, target);
        break;
      }
      case 'placeBuilding':
        this.construction.placeBuilding(playerId, command.buildingType, command.tileX, command.tileY, units, command.queue === true);
        break;
      case 'construct': {
        const site = world.getEntity(command.buildingId);
        if (site?.kind === 'building') for (const unit of units) this.construction.startConstruct(unit, site);
        break;
      }
      case 'repair': {
        const site = world.getEntity(command.buildingId);
        if (site?.kind === 'building') for (const unit of units) this.construction.startRepair(unit, site);
        break;
      }
      case 'deposit': {
        const dropsite = world.getEntity(command.dropsiteId);
        if (dropsite?.kind === 'building') for (const unit of units) this.economy.startDeposit(unit, dropsite);
        break;
      }
    }
  }

  private stopUnit(unit: UnitEntity): void {
    unit.task = null;
    unit.state = 'idle';
    unit.guardX = unit.x;
    unit.guardY = unit.y;
    this.movement.stopMovement(unit);
  }

  private clampToMap(p: { x: number; y: number }) {
    return {
      x: Math.max(0, Math.min(this.world.width - 0.001, p.x)),
      y: Math.max(0, Math.min(this.world.height - 0.001, p.y)),
    };
  }

  /**
   * Unidades sem tarefa que terminaram (ou falharam) o deslocamento ficam ociosas e passam
   * a guardar a posição atual (referência para a postura defensiva).
   */
  private settleIdleUnits(): void {
    for (const unit of this.world.units) {
      if (unit.task || unit.moveGoal) continue;
      if (unit.state !== 'idle') {
        unit.guardX = unit.x;
        unit.guardY = unit.y;
      }
      unit.state = 'idle';
      unit.moveStatus = 'none';
      unit.attackMoveGoal = null;
    }
  }
}
