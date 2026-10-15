import { ECONOMY } from '@eoc/game-data';
import type { World } from '../core/World';
import type { BuildingEntity, GatherTask, ResourceEntity, UnitEntity } from '../entities/types';
import type { MovementSystem } from '../movement/MovementSystem';
import { approachTarget, inReach } from '../orders/approach';
import {
  acceptsResource,
  findNearestDropsite,
  findNearestResource,
  gathererStats,
  isAccessible,
  rectOf,
  unitComponent,
} from './queries';

/** Folga extra de alcance quando a unidade já está trabalhando (tolerância a empurrões). */
const WORKING_SLACK = 0.3;
/** Folga extra ao chegar ao destino de aproximação. */
const ARRIVAL_SLACK = 0.25;

/**
 * Ciclo econômico dos aldeões: aproximar → coletar até a capacidade → levar ao depósito
 * mais próximo → voltar à mesma fonte (ou a outra do mesmo tipo, se ela se esgotar).
 *
 * Os recursos são inteiros: cada unidade coletada sai da fonte e entra na carga, e cada
 * unidade depositada sai da carga e entra no estoque do jogador (conservação garantida).
 */
export class EconomySystem {
  constructor(
    private readonly world: World,
    private readonly movement: MovementSystem,
  ) {}

  /** Ordena a coleta. Se a fonte for inacessível, tenta outra próxima do mesmo tipo. */
  startGather(unit: UnitEntity, target: ResourceEntity): void {
    if (!gathererStats(unit)) return;
    let chosen: ResourceEntity | null = target;
    const component = unitComponent(this.world, unit);
    if (!isAccessible(this.world, rectOf(target), component)) {
      chosen = findNearestResource(this.world, target.nodeType, target.x, target.y, ECONOMY.retargetRadius, component, target.id);
    }
    if (!chosen) {
      // Nenhuma fonte alcançável: apenas se aproxima do ponto clicado.
      unit.task = null;
      unit.state = 'moving';
      this.movement.moveUnit(unit, { x: target.x, y: target.y });
      return;
    }
    // Trocar de tipo de recurso descarta a carga atual.
    if (unit.carryType && unit.carryType !== chosen.resource) {
      unit.carryType = null;
      unit.carryAmount = 0;
    }
    unit.gatherProgress = 0;
    unit.task = {
      type: 'gather',
      phase: 'toResource',
      targetId: chosen.id,
      nodeType: chosen.nodeType,
      lastX: chosen.x,
      lastY: chosen.y,
      dropsiteId: null,
      approachAttempts: 0,
    };
    if (!this.approach(unit, chosen)) this.becomeIdle(unit);
  }

  /** Ordena levar a carga a um depósito específico; depois retoma a coleta anterior, se houver. */
  startDeposit(unit: UnitEntity, dropsite: BuildingEntity): void {
    if (!gathererStats(unit)) return;
    const previous = unit.task?.type === 'gather' ? unit.task : null;
    unit.task = {
      type: 'gather',
      phase: 'toDropsite',
      targetId: previous?.targetId ?? null,
      nodeType: previous?.nodeType ?? null,
      lastX: previous?.lastX ?? unit.x,
      lastY: previous?.lastY ?? unit.y,
      dropsiteId: dropsite.id,
      approachAttempts: 0,
    };
    if (unit.carryAmount <= 0) {
      this.resume(unit, unit.task);
      return;
    }
    if (!this.approach(unit, dropsite)) this.becomeIdle(unit);
  }

  update(dt: number): void {
    for (const unit of this.world.units) {
      if (unit.task?.type === 'gather') this.updateGatherer(unit, unit.task, dt);
    }
  }

  /** O aldeão deixa a tarefa econômica e fica ocioso (usado por outros sistemas). */
  release(unit: UnitEntity): void {
    this.becomeIdle(unit);
  }

  private updateGatherer(unit: UnitEntity, task: GatherTask, dt: number): void {
    switch (task.phase) {
      case 'toResource':
        return this.updateToResource(unit, task);
      case 'gathering':
        return this.updateGathering(unit, task, dt);
      case 'toDropsite':
        return this.updateToDropsite(unit, task);
    }
  }

  private updateToResource(unit: UnitEntity, task: GatherTask): void {
    const target = this.resource(task.targetId);
    if (!target) return this.retarget(unit, task, null);
    const slack = unit.moveStatus === 'arrived' ? ARRIVAL_SLACK : 0;
    if (this.inReach(unit, target, slack)) {
      this.movement.stopMovement(unit);
      task.phase = 'gathering';
      task.approachAttempts = 0;
      unit.state = 'gathering';
      return;
    }
    if (unit.moveStatus === 'moving') return;
    task.approachAttempts++;
    if (task.approachAttempts > ECONOMY.maxApproachAttempts || !this.approach(unit, target)) this.retarget(unit, task, target.id);
  }

  private updateGathering(unit: UnitEntity, task: GatherTask, dt: number): void {
    const stats = gathererStats(unit);
    const player = this.world.getPlayer(unit.owner);
    const target = this.resource(task.targetId);
    if (!stats || !player) return this.becomeIdle(unit);
    if (!target) return this.retarget(unit, task, null);
    if (!this.inReach(unit, target, WORKING_SLACK)) {
      task.phase = 'toResource';
      if (!this.approach(unit, target)) this.retarget(unit, task, target.id);
      return;
    }

    unit.state = 'gathering';
    unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
    if (unit.carryType !== target.resource) {
      unit.carryType = target.resource;
      unit.carryAmount = 0;
    }
    const capacity = stats.carryCapacity + player.modifiers.carryCapacity;
    unit.gatherProgress += stats.rates[target.nodeType] * player.modifiers.gatherRate[target.resource] * dt;
    while (unit.gatherProgress >= 1 && unit.carryAmount < capacity && target.amount > 0) {
      if (target.amount === target.initialAmount) this.world.emit({ type: 'resourceTouched', id: target.id });
      unit.gatherProgress -= 1;
      unit.carryAmount += 1;
      target.amount -= 1;
    }

    const depleted = target.amount <= 0;
    if (depleted) this.world.removeEntity(target.id);
    if (unit.carryAmount >= capacity) {
      unit.gatherProgress = 0;
      if (depleted) task.targetId = null;
      this.goDeposit(unit, task);
    } else if (depleted) {
      this.retarget(unit, task, null);
    }
  }

  private updateToDropsite(unit: UnitEntity, task: GatherTask): void {
    if (unit.carryAmount <= 0 || !unit.carryType) return this.resume(unit, task);
    let dropsite = this.building(task.dropsiteId);
    if (!dropsite || dropsite.owner !== unit.owner || !acceptsResource(dropsite, unit.carryType)) {
      dropsite = findNearestDropsite(this.world, unit.owner, unit.carryType, unit.x, unit.y);
      if (!dropsite) return this.noDropsite(unit);
      task.dropsiteId = dropsite.id;
      task.approachAttempts = 0;
      if (!this.approach(unit, dropsite)) return this.becomeIdle(unit);
    }
    const slack = unit.moveStatus === 'arrived' ? ARRIVAL_SLACK : 0;
    if (this.inReach(unit, dropsite, slack)) {
      this.deposit(unit, dropsite);
      this.resume(unit, task);
      return;
    }
    if (unit.moveStatus === 'moving') return;
    task.approachAttempts++;
    if (task.approachAttempts > ECONOMY.maxApproachAttempts || !this.approach(unit, dropsite)) this.becomeIdle(unit);
  }

  private deposit(unit: UnitEntity, dropsite: BuildingEntity): void {
    const player = this.world.getPlayer(unit.owner);
    const resource = unit.carryType;
    const amount = unit.carryAmount;
    if (!player || !resource || amount <= 0) return;
    player.resources[resource] += amount;
    player.stats.gathered[resource] += amount;
    unit.carryAmount = 0;
    unit.carryType = null;
    this.movement.stopMovement(unit);
    this.world.emit({ type: 'deposited', playerId: player.id, unitId: unit.id, dropsiteId: dropsite.id, resource, amount });
  }

  /** Após depositar: volta à mesma fonte, procura outra próxima ou fica ocioso. */
  private resume(unit: UnitEntity, task: GatherTask): void {
    task.dropsiteId = null;
    task.approachAttempts = 0;
    const target = this.resource(task.targetId);
    if (target) {
      task.phase = 'toResource';
      unit.state = 'moving';
      if (!this.approach(unit, target)) this.retarget(unit, task, target.id);
      return;
    }
    this.retarget(unit, task, null);
  }

  /** Procura outra fonte do mesmo tipo perto da última; sem fonte, deposita a carga ou fica ocioso. */
  private retarget(unit: UnitEntity, task: GatherTask, excludeId: number | null): void {
    const next = task.nodeType
      ? findNearestResource(this.world, task.nodeType, task.lastX, task.lastY, ECONOMY.retargetRadius, unitComponent(this.world, unit), excludeId)
      : null;
    if (next) {
      task.targetId = next.id;
      task.lastX = next.x;
      task.lastY = next.y;
      task.phase = 'toResource';
      task.approachAttempts = 0;
      if (!this.approach(unit, next)) this.becomeIdle(unit);
      return;
    }
    task.targetId = null;
    task.nodeType = null;
    if (unit.carryAmount > 0 && task.phase !== 'toDropsite') this.goDeposit(unit, task);
    else this.becomeIdle(unit);
  }

  private goDeposit(unit: UnitEntity, task: GatherTask): void {
    if (!unit.carryType) return this.becomeIdle(unit);
    const dropsite = findNearestDropsite(this.world, unit.owner, unit.carryType, unit.x, unit.y);
    if (!dropsite) return this.noDropsite(unit);
    task.phase = 'toDropsite';
    task.dropsiteId = dropsite.id;
    task.approachAttempts = 0;
    if (!this.approach(unit, dropsite)) this.becomeIdle(unit);
  }

  private noDropsite(unit: UnitEntity): void {
    if (unit.carryType) this.world.emit({ type: 'noDropsite', playerId: unit.owner, unitId: unit.id, resource: unit.carryType });
    this.becomeIdle(unit);
  }

  private approach(unit: UnitEntity, target: BuildingEntity | ResourceEntity): boolean {
    return approachTarget(this.world, this.movement, unit, target);
  }

  private becomeIdle(unit: UnitEntity): void {
    unit.task = null;
    unit.state = 'idle';
    unit.gatherProgress = 0;
    this.movement.stopMovement(unit);
  }

  private inReach(unit: UnitEntity, target: BuildingEntity | ResourceEntity, slack: number): boolean {
    return inReach(unit, target, slack);
  }

  private resource(id: number | null): ResourceEntity | null {
    if (id === null) return null;
    const e = this.world.getEntity(id);
    return e && e.kind === 'resource' && e.amount > 0 ? e : null;
  }

  private building(id: number | null): BuildingEntity | null {
    if (id === null) return null;
    const e = this.world.getEntity(id);
    return e && e.kind === 'building' ? e : null;
  }
}
