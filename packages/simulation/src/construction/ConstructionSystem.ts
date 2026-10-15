import { ECONOMY, RESOURCE_NODE_DEFINITIONS, getBuildingDefinition, type ResourceNodeType } from '@eoc/game-data';
import { RESOURCE_TYPES, type EntityId, type PlayerId, type ResourceAmounts } from '@eoc/shared';
import type { World } from '../core/World';
import type { EconomySystem } from '../economy/EconomySystem';
import { findNearestResource, unitComponent } from '../economy/queries';
import type { BuildTask, BuildingEntity, UnitEntity } from '../entities/types';
import type { MovementSystem } from '../movement/MovementSystem';
import { approachTarget, inReach } from '../orders/approach';
import { payCost } from './placement';

const WORKING_SLACK = 0.3;
const ARRIVAL_SLACK = 0.25;
const MAX_APPROACH_ATTEMPTS = 3;

/**
 * Obras: posicionamento da fundação, deslocamento dos construtores e progresso.
 *
 * Velocidade com N construtores (fórmula clássica do gênero): tempo = 3·T / (N + 2),
 * ou seja, cada aldeão extra ajuda, mas com retorno decrescente.
 */
export class ConstructionSystem {
  private readonly builderCount = new Map<EntityId, number>();

  constructor(
    private readonly world: World,
    private readonly movement: MovementSystem,
    private readonly economy: EconomySystem,
  ) {}

  /** Cria a fundação (já validada), cobra o custo e designa os construtores. */
  placeBuilding(playerId: PlayerId, type: string, tileX: number, tileY: number, builders: UnitEntity[], queue: boolean): BuildingEntity | null {
    const player = this.world.getPlayer(playerId);
    if (!player) return null;
    payCost(player, getBuildingDefinition(type).cost);
    const building = this.world.addBuilding(type, playerId, tileX, tileY, false);
    this.relocateUnitsInside(building);
    this.world.emit({ type: 'buildingPlaced', id: building.id, playerId, buildingType: type });
    for (const unit of builders) {
      if (queue && unit.task?.type === 'build') unit.buildQueue.push(building.id);
      else this.startConstruct(unit, building);
    }
    return building;
  }

  /** Envia o aldeão para trabalhar na obra (substitui a tarefa atual). */
  startConstruct(unit: UnitEntity, building: BuildingEntity): void {
    // A carga atual é mantida; o aldeão pode depositá-la depois da obra.
    unit.gatherProgress = 0;
    unit.task = { type: 'build', phase: 'toSite', targetId: building.id, approachAttempts: 0 };
    if (!approachTarget(this.world, this.movement, unit, building)) this.finishTask(unit, null);
  }

  /** Cancela uma obra, devolvendo o custo proporcional ao que falta construir. */
  cancel(building: BuildingEntity): void {
    const player = this.world.getPlayer(building.owner);
    const cost = getBuildingDefinition(building.type).cost;
    const refund: Partial<ResourceAmounts> = {};
    for (const r of RESOURCE_TYPES) {
      const amount = Math.floor((cost[r] ?? 0) * (1 - building.buildProgress));
      if (amount > 0) {
        refund[r] = amount;
        if (player) player.resources[r] += amount;
      }
    }
    this.world.emit({ type: 'buildingCancelled', id: building.id, playerId: building.owner, buildingType: building.type, refund });
    this.world.removeEntity(building.id);
  }

  update(dt: number): void {
    this.builderCount.clear();
    for (const unit of this.world.units) {
      if (unit.task?.type === 'build') this.updateBuilder(unit, unit.task);
    }
    for (const [id, count] of this.builderCount) {
      const building = this.world.getEntity(id);
      if (building?.kind === 'building' && !building.complete) this.advance(building, count, dt);
    }
  }

  private updateBuilder(unit: UnitEntity, task: BuildTask): void {
    const site = this.site(task.targetId, unit);
    if (!site) return this.finishTask(unit, null);
    if (task.phase === 'toSite') {
      const slack = unit.moveStatus === 'arrived' ? ARRIVAL_SLACK : 0;
      if (inReach(unit, site, slack)) {
        this.movement.stopMovement(unit);
        task.phase = 'building';
        task.approachAttempts = 0;
      } else {
        if (unit.moveStatus === 'moving') return;
        task.approachAttempts++;
        if (task.approachAttempts > MAX_APPROACH_ATTEMPTS || !approachTarget(this.world, this.movement, unit, site)) this.finishTask(unit, null);
        return;
      }
    }
    if (!inReach(unit, site, WORKING_SLACK)) {
      task.phase = 'toSite';
      if (!approachTarget(this.world, this.movement, unit, site)) this.finishTask(unit, null);
      return;
    }
    unit.state = 'building';
    unit.heading = Math.atan2(site.y - unit.y, site.x - unit.x);
    this.builderCount.set(site.id, (this.builderCount.get(site.id) ?? 0) + 1);
  }

  private advance(building: BuildingEntity, builders: number, dt: number): void {
    const def = getBuildingDefinition(building.type);
    const speed = this.world.getPlayer(building.owner)?.modifiers.buildSpeed ?? 1;
    const rate = ((builders + 2) / (3 * def.buildTime)) * speed;
    const delta = Math.min(1 - building.buildProgress, rate * dt);
    building.buildProgress += delta;
    building.hp = Math.min(building.maxHp, building.hp + building.maxHp * delta);
    if (building.buildProgress >= 1 - 1e-9) {
      this.world.completeBuilding(building);
      for (const unit of this.world.units) {
        if (unit.task?.type === 'build' && unit.task.targetId === building.id) this.finishTask(unit, building);
      }
    }
  }

  /**
   * Fim da obra (ou obra perdida): próxima obra da fila; se o edifício concluído for um
   * depósito especializado, começa a coletar o recurso correspondente mais próximo; senão, ocioso.
   */
  private finishTask(unit: UnitEntity, completed: BuildingEntity | null): void {
    unit.task = null;
    while (unit.buildQueue.length > 0) {
      const next = this.site(unit.buildQueue.shift()!, unit);
      if (next) return this.startConstruct(unit, next);
    }
    if (completed && completed.type !== 'townCenter') {
      const accepts = getBuildingDefinition(completed.type).dropsiteFor;
      const component = unitComponent(this.world, unit);
      for (const nodeType of Object.keys(RESOURCE_NODE_DEFINITIONS) as ResourceNodeType[]) {
        if (!accepts.includes(RESOURCE_NODE_DEFINITIONS[nodeType].resource)) continue;
        const target = findNearestResource(this.world, nodeType, completed.x, completed.y, ECONOMY.retargetRadius + 2, component);
        if (target) return this.economy.startGather(unit, target);
      }
    }
    this.economy.release(unit);
  }

  /** Obra válida para o aldeão: existe, é do mesmo dono e ainda não foi concluída. */
  private site(id: EntityId, unit: UnitEntity): BuildingEntity | null {
    const e = this.world.getEntity(id);
    return e && e.kind === 'building' && e.owner === unit.owner && !e.complete ? e : null;
  }

  /** Unidades próprias dentro da área da nova obra são movidas para o tile livre mais próximo. */
  private relocateUnitsInside(building: BuildingEntity): void {
    const grid = this.world.grid;
    for (const unit of this.world.units) {
      const inside =
        unit.x >= building.tileX && unit.x < building.tileX + building.width && unit.y >= building.tileY && unit.y < building.tileY + building.height;
      if (!inside) continue;
      const spot = grid.findNearestWalkable(Math.floor(unit.x), Math.floor(unit.y), null, 8);
      if (!spot) continue;
      unit.x = unit.prevX = spot.x + 0.5;
      unit.y = unit.prevY = spot.y + 0.5;
      if (unit.moveGoal) this.movement.moveUnit(unit, unit.moveGoal);
    }
  }
}
