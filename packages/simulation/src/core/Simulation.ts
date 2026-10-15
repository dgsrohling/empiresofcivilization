import { TICK_DT, type CommandResult, type GameCommand, type IssuedCommand, type PlayerId } from '@eoc/shared';
import { resolveUnits, validateCommand } from '../commands/CommandProcessor';
import { ConstructionSystem } from '../construction/ConstructionSystem';
import { EconomySystem } from '../economy/EconomySystem';
import type { SimEvent } from '../entities/types';
import { distributeDestinations } from '../movement/formation';
import { MovementSystem } from '../movement/MovementSystem';
import { PathService } from '../pathfinding/PathService';
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
  private queue: IssuedCommand[] = [];

  constructor(readonly world: World) {
    this.paths = new PathService(world.grid);
    this.movement = new MovementSystem(world, this.paths);
    this.economy = new EconomySystem(world, this.movement);
    this.construction = new ConstructionSystem(world, this.movement, this.economy);
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

    this.movement.update(TICK_DT);
    this.economy.update(TICK_DT);
    this.construction.update(TICK_DT);
    this.settleIdleUnits();
    world.tick++;
    world.time = world.tick * TICK_DT;
  }

  private apply({ playerId, command }: IssuedCommand): void {
    if (!validateCommand(this.world, playerId, command).ok) return;
    if (command.type === 'cancelBuilding') {
      const site = this.world.getEntity(command.buildingId);
      if (site?.kind === 'building') this.construction.cancel(site);
      return;
    }
    const units = resolveUnits(this.world, command.unitIds);
    const keepsQueue = command.type === 'placeBuilding' && command.queue === true;
    if (!keepsQueue) for (const unit of units) unit.buildQueue = [];
    switch (command.type) {
      case 'move': {
        for (const unit of units) {
          unit.task = null;
          unit.state = 'moving';
        }
        const target = {
          x: Math.max(0, Math.min(this.world.width - 0.001, command.target.x)),
          y: Math.max(0, Math.min(this.world.height - 0.001, command.target.y)),
        };
        const goals = distributeDestinations(this.world.grid, target, units);
        units.forEach((unit, i) => this.movement.moveUnit(unit, goals[i]!));
        break;
      }
      case 'stop':
        for (const unit of units) {
          unit.task = null;
          unit.state = 'idle';
          this.movement.stopMovement(unit);
        }
        break;
      case 'gather': {
        const target = this.world.getEntity(command.targetId);
        if (target?.kind === 'resource') for (const unit of units) this.economy.startGather(unit, target);
        break;
      }
      case 'placeBuilding':
        this.construction.placeBuilding(playerId, command.buildingType, command.tileX, command.tileY, units, command.queue === true);
        break;
      case 'construct': {
        const site = this.world.getEntity(command.buildingId);
        if (site?.kind === 'building') for (const unit of units) this.construction.startConstruct(unit, site);
        break;
      }
      case 'deposit': {
        const dropsite = this.world.getEntity(command.dropsiteId);
        if (dropsite?.kind === 'building') for (const unit of units) this.economy.startDeposit(unit, dropsite);
        break;
      }
    }
  }

  /** Unidades sem tarefa que terminaram (ou falharam) o deslocamento voltam a ficar ociosas. */
  private settleIdleUnits(): void {
    for (const unit of this.world.units) {
      if (unit.task || unit.moveGoal) continue;
      unit.state = 'idle';
      unit.moveStatus = 'none';
    }
  }
}
