import { STARTING_UNITS } from '@eoc/game-data';
import type { PlayerId, Vec2 } from '@eoc/shared';
import { generateMap } from '../map/generateMap';
import { startFootprint } from '../map/types';
import { createPlayerState } from './players';
import { Simulation } from './Simulation';
import { World } from './World';

export interface MatchPlayerConfig {
  id: PlayerId;
  name: string;
  color: number;
  isHuman: boolean;
}

export interface MatchConfig {
  seed: number;
  mapSize: number;
  players: MatchPlayerConfig[];
  river?: boolean;
}

/** Cria uma partida: gera o mapa, posiciona recursos, Centros da Vila e unidades iniciais. */
export function createMatch(config: MatchConfig): Simulation {
  if (config.players.length === 0) throw new Error('A partida precisa de ao menos um jogador');
  const map = generateMap({ seed: config.seed, size: config.mapSize, playerCount: config.players.length, river: config.river });
  const world = new World(map);
  for (const spec of map.resources) world.addResource(spec);

  config.players.forEach((p, index) => {
    world.addPlayer(createPlayerState(p));
    const spawn = map.spawns[index]!;
    const fp = startFootprint(spawn);
    world.addBuilding('townCenter', p.id, fp.x, fp.y);

    const center = { x: map.width / 2, y: map.height / 2 };
    const spots = findSpawnSpots(world, fp, center);
    let k = 0;
    for (const { type, count } of STARTING_UNITS) {
      for (let c = 0; c < count; c++) {
        const spot = spots[k++ % spots.length]!;
        world.addUnit(type, p.id, spot.x, spot.y);
      }
    }
  });

  return new Simulation(world);
}

/** Tiles livres ao redor de uma área, priorizando o lado voltado para o centro do mapa. */
function findSpawnSpots(world: World, fp: { x: number; y: number; w: number; h: number }, toward: Vec2): Vec2[] {
  const spots: Vec2[] = [];
  const cx = fp.x + fp.w / 2;
  const cy = fp.y + fp.h / 2;
  const dirX = toward.x - cx;
  const dirY = toward.y - cy;
  const score = (p: Vec2) => (p.x - cx) * dirX + (p.y - cy) * dirY;
  for (let ring = 1; ring <= 4; ring++) {
    const ringSpots: Vec2[] = [];
    for (let y = fp.y - ring; y < fp.y + fp.h + ring; y++) {
      for (let x = fp.x - ring; x < fp.x + fp.w + ring; x++) {
        const inside = x >= fp.x - ring + 1 && x < fp.x + fp.w + ring - 1 && y >= fp.y - ring + 1 && y < fp.y + fp.h + ring - 1;
        if (inside || !world.grid.isWalkable(x, y)) continue;
        ringSpots.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    ringSpots.sort((a, b) => score(b) - score(a));
    spots.push(...ringSpots);
  }
  if (spots.length === 0) throw new Error('Sem espaço livre para unidades iniciais');
  return spots;
}
