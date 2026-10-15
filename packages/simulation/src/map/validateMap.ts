import { getTerrain, type ResourceNodeType } from '@eoc/game-data';
import type { GeneratedMap } from './types';
import { startFootprint } from './types';

export interface MapValidationReport {
  valid: boolean;
  issues: string[];
}

/** Requisitos mínimos de recursos a até `RESOURCE_RADIUS` tiles de cada ponto de nascimento. */
export const MIN_START_RESOURCES: Record<ResourceNodeType, number> = {
  goldMine: 5,
  stoneMine: 4,
  berryBush: 4,
  tree: 15,
};
const RESOURCE_RADIUS = 16;

/**
 * Valida um mapa gerado: conectividade entre todos os pontos de nascimento, área livre
 * para o Centro da Vila e acesso mínimo (alcançável a pé) a cada tipo de recurso.
 */
export function validateMap(map: GeneratedMap): MapValidationReport {
  const { width, height, terrain } = map;
  const issues: string[] = [];
  const size = width * height;
  const occupied = new Uint8Array(size);
  for (const r of map.resources) occupied[r.y * width + r.x] = 1;
  const walkable = (i: number) => getTerrain(terrain[i] as number).walkable && occupied[i] === 0;

  if (map.spawns.length === 0) return { valid: false, issues: ['Nenhum ponto de nascimento'] };

  for (const [p, spawn] of map.spawns.entries()) {
    const fp = startFootprint(spawn);
    for (let y = fp.y; y < fp.y + fp.h; y++) {
      for (let x = fp.x; x < fp.x + fp.w; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          issues.push(`Jogador ${p + 1}: Centro da Vila fora do mapa`);
          continue;
        }
        const i = y * width + x;
        if (!getTerrain(terrain[i] as number).buildable || occupied[i]) issues.push(`Jogador ${p + 1}: área do Centro da Vila obstruída em (${x},${y})`);
      }
    }
  }

  // Flood fill (4 direções) a partir do primeiro ponto de nascimento.
  const first = map.spawns[0]!;
  const reach = new Uint8Array(size);
  const stack = [first.y * width + first.x];
  if (walkable(stack[0]!)) reach[stack[0]!] = 1;
  else stack.length = 0;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % width;
    const y = (i / width) | 0;
    const neighbors = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1];
    for (const n of neighbors) {
      if (n >= 0 && !reach[n] && walkable(n)) {
        reach[n] = 1;
        stack.push(n);
      }
    }
  }

  for (const [p, spawn] of map.spawns.entries()) {
    if (!reach[spawn.y * width + spawn.x]) issues.push(`Jogador ${p + 1}: ponto de nascimento desconectado`);
    for (const [type, min] of Object.entries(MIN_START_RESOURCES) as [ResourceNodeType, number][]) {
      let count = 0;
      let accessible = false;
      for (const r of map.resources) {
        if (r.type !== type) continue;
        if (Math.hypot(r.x + 0.5 - spawn.x, r.y + 0.5 - spawn.y) > RESOURCE_RADIUS) continue;
        count++;
        if (!accessible) {
          const ns = [
            [r.x - 1, r.y],
            [r.x + 1, r.y],
            [r.x, r.y - 1],
            [r.x, r.y + 1],
          ] as const;
          accessible = ns.some(([nx, ny]) => nx >= 0 && ny >= 0 && nx < width && ny < height && reach[ny * width + nx] === 1);
        }
      }
      if (count < min) issues.push(`Jogador ${p + 1}: ${type} insuficiente (${count}/${min})`);
      else if (!accessible) issues.push(`Jogador ${p + 1}: ${type} inacessível`);
    }
  }

  return { valid: issues.length === 0, issues };
}
