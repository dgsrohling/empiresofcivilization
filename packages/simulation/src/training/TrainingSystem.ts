import { MAX_POPULATION, getBuildingDefinition, getUnitDefinition } from '@eoc/game-data';
import { RESOURCE_TYPES, type EntityId, type Vec2 } from '@eoc/shared';
import { payCost } from '../construction/placement';
import type { World } from '../core/World';
import type { EconomySystem } from '../economy/EconomySystem';
import type { BuildingEntity, UnitEntity } from '../entities/types';
import type { MovementSystem } from '../movement/MovementSystem';

/**
 * Filas de treinamento. O custo é cobrado ao enfileirar e devolvido integralmente ao cancelar.
 * O item da frente só progride se houver espaço na população; a unidade nasce ao lado do
 * edifício, do lado do ponto de reunião, e segue até ele (ou começa a coletar, se for um recurso).
 */
export class TrainingSystem {
  /** Edifícios que já avisaram falta de população (evita repetir o aviso a cada tick). */
  private readonly blocked = new Set<EntityId>();

  constructor(
    private readonly world: World,
    private readonly movement: MovementSystem,
    private readonly economy: EconomySystem,
  ) {}

  enqueue(building: BuildingEntity, unitType: string): void {
    const player = this.world.getPlayer(building.owner);
    if (!player) return;
    payCost(player, getUnitDefinition(unitType).cost);
    building.queue.push({ unitType, progress: 0 });
  }

  cancel(building: BuildingEntity, index: number): void {
    const item = building.queue[index];
    const player = this.world.getPlayer(building.owner);
    if (!item || !player) return;
    const cost = getUnitDefinition(item.unitType).cost;
    for (const r of RESOURCE_TYPES) player.resources[r] += cost[r] ?? 0;
    building.queue.splice(index, 1);
    if (index === 0) this.blocked.delete(building.id);
  }

  setRallyPoint(building: BuildingEntity, target: Vec2, targetId: EntityId | null): void {
    building.rallyPoint = { x: target.x, y: target.y, targetId };
  }

  update(dt: number): void {
    for (const building of this.world.buildings) {
      if (!building.complete || building.queue.length === 0) continue;
      const player = this.world.getPlayer(building.owner);
      if (!player) continue;
      const item = building.queue[0]!;
      const def = getUnitDefinition(item.unitType);
      const cap = Math.min(player.populationCap, MAX_POPULATION);
      if (item.progress === 0 && player.population + def.populationCost > cap) {
        if (!this.blocked.has(building.id)) {
          this.blocked.add(building.id);
          this.world.emit({ type: 'trainingBlocked', buildingId: building.id, playerId: player.id, reason: 'population' });
        }
        continue;
      }
      this.blocked.delete(building.id);
      item.progress += dt * player.modifiers.trainSpeed;
      if (item.progress >= def.trainTime) {
        building.queue.shift();
        this.spawn(building, item.unitType);
      }
    }
  }

  private spawn(building: BuildingEntity, unitType: string): UnitEntity {
    const rally = building.rallyPoint;
    const toward = rally ?? { x: this.world.width / 2, y: this.world.height / 2 };
    const spot = this.spawnPoint(building, toward);
    const unit = this.world.addUnit(unitType, building.owner, spot.x, spot.y);
    unit.heading = Math.atan2(toward.y - spot.y, toward.x - spot.x);
    const player = this.world.getPlayer(building.owner);
    if (player) player.stats.unitsTrained++;
    this.world.emit({ type: 'unitTrained', id: unit.id, buildingId: building.id, playerId: building.owner, unitType });

    if (rally) {
      const target = rally.targetId !== null ? this.world.getEntity(rally.targetId) : undefined;
      if (target?.kind === 'resource' && getUnitDefinition(unitType).gatherer) {
        this.economy.startGather(unit, target);
      } else if (Math.hypot(rally.x - unit.x, rally.y - unit.y) > 0.5) {
        unit.state = 'moving';
        this.movement.moveUnit(unit, rally);
      }
    }
    return unit;
  }

  /** Tile livre ao redor do edifício, o mais próximo possível de `toward`. */
  private spawnPoint(building: BuildingEntity, toward: Vec2): Vec2 {
    const grid = this.world.grid;
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let ring = 1; ring <= 3 && !best; ring++) {
      for (let y = building.tileY - ring; y < building.tileY + building.height + ring; y++) {
        for (let x = building.tileX - ring; x < building.tileX + building.width + ring; x++) {
          const border = x === building.tileX - ring || x === building.tileX + building.width + ring - 1 || y === building.tileY - ring || y === building.tileY + building.height + ring - 1;
          if (!border || !grid.isWalkable(x, y)) continue;
          const d = Math.hypot(x + 0.5 - toward.x, y + 0.5 - toward.y);
          if (d < bestDist) {
            bestDist = d;
            best = { x: x + 0.5, y: y + 0.5 };
          }
        }
      }
    }
    if (best) return best;
    const near = grid.findNearestWalkable(Math.floor(building.x), Math.floor(building.y), null, 16);
    return near ? { x: near.x + 0.5, y: near.y + 0.5 } : { x: building.x, y: building.y };
  }

  /** O edifício pode treinar este tipo de unidade? */
  static trains(building: BuildingEntity, unitType: string): boolean {
    return getBuildingDefinition(building.type).trains.includes(unitType);
  }
}
