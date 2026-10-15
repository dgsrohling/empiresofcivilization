import { AGE_NAMES, BUILD_MENU, RESOURCE_NODE_DEFINITIONS, getBuildingDefinition, getUnitDefinition } from '@eoc/game-data';
import type { EntityId, PlayerId, ResourceAmounts, ResourceType } from '@eoc/shared';
import { checkBuildingAvailability, type Entity, type UnitEntity, type World } from '@eoc/simulation';
import { toCssColor } from './rendering/color';
import { buildingTexture, resourceTexture, unitTexture } from './rendering/textureKeys';

export interface SelectedInfo {
  id: EntityId;
  kind: Entity['kind'];
  type: string;
  name: string;
  description: string;
  iconKey: string;
  ownerName: string;
  ownerColor: string;
  isOwn: boolean;
  hp: number;
  maxHp: number;
  stats: Array<{ label: string; value: string }>;
  status: string;
  carry: { resource: ResourceType; amount: number; capacity: number } | null;
  /** Progresso de obra em [0, 1] (somente edifícios não concluídos). */
  buildProgress: number | null;
}

export interface BuildOption {
  type: string;
  name: string;
  description: string;
  hotkey: string;
  cost: Partial<ResourceAmounts>;
  iconKey: string;
  available: boolean;
  reason?: string;
}

export interface EconomySummary {
  /** Aldeões designados a cada recurso. */
  workers: ResourceAmounts;
  idleVillagers: number;
  gathered: ResourceAmounts;
  ratePerMinute: ResourceAmounts;
}

export interface SelectionGroupInfo {
  type: string;
  name: string;
  count: number;
  iconKey: string;
}

export interface HudSnapshot {
  time: number;
  playerName: string;
  playerColor: string;
  resources: ResourceAmounts;
  population: number;
  populationCap: number;
  ageName: string;
  economy: EconomySummary;
  selection: {
    count: number;
    primary: SelectedInfo | null;
    groups: SelectionGroupInfo[];
    hasOwnUnits: boolean;
    /** Opções do menu de construção (vazio se não houver construtores próprios selecionados). */
    buildOptions: BuildOption[];
  };
}

const STATE_NAMES: Record<string, string> = { idle: 'Ocioso', moving: 'Em movimento', gathering: 'Coletando', building: 'Construindo' };
export const RESOURCE_NAMES: Record<ResourceType, string> = { food: 'comida', wood: 'madeira', gold: 'ouro', stone: 'pedra' };

/** Recurso ao qual o aldeão está dedicado (pela fonte-alvo ou pela carga). */
export function taskResource(unit: UnitEntity): ResourceType | null {
  const task = unit.task;
  if (!task || task.type !== 'gather') return null;
  if (task.nodeType) return RESOURCE_NODE_DEFINITIONS[task.nodeType].resource;
  return unit.carryType;
}

function unitStatus(world: World, unit: UnitEntity): string {
  const task = unit.task;
  if (!task) return STATE_NAMES[unit.state] ?? unit.state;
  if (task.type === 'build') {
    const site = world.getEntity(task.targetId);
    const name = site ? getBuildingDefinition(site.type).name : 'edifício';
    const queued = unit.buildQueue.length > 0 ? ` (+${unit.buildQueue.length} na fila)` : '';
    return (task.phase === 'building' ? `Construindo ${name}` : `Indo construir ${name}`) + queued;
  }
  if (task.type === 'repair') {
    const site = world.getEntity(task.targetId);
    const name = site ? getBuildingDefinition(site.type).name : 'edifício';
    return task.phase === 'repairing' ? `Reparando ${name}` : `Indo reparar ${name}`;
  }
  if (task.type === 'attack') {
    const target = world.getEntity(task.targetId);
    const name = !target ? 'inimigo' : target.kind === 'building' ? getBuildingDefinition(target.type).name : target.kind === 'unit' ? getUnitDefinition(target.type).name : 'alvo';
    return unit.state === 'attacking' ? `Atacando ${name}` : `Perseguindo ${name}`;
  }
  const resource = taskResource(unit);
  const name = resource ? RESOURCE_NAMES[resource] : 'recursos';
  switch (task.phase) {
    case 'toResource':
      return `Indo coletar ${name}`;
    case 'gathering':
      return `Coletando ${name}`;
    case 'toDropsite':
      return `Levando ${unit.carryType ? RESOURCE_NAMES[unit.carryType] : name} ao depósito`;
  }
}

export function iconKeyFor(e: Entity): string {
  if (e.kind === 'unit') return unitTexture(e.type, e.owner);
  if (e.kind === 'building') return buildingTexture(e.type, e.owner);
  return resourceTexture(e.nodeType, 0);
}

function describe(world: World, e: Entity, localPlayerId: PlayerId): SelectedInfo {
  const owner = world.getPlayer(e.owner);
  const base = {
    id: e.id,
    kind: e.kind,
    type: e.type,
    iconKey: iconKeyFor(e),
    ownerName: owner?.name ?? 'Natureza',
    ownerColor: owner ? toCssColor(owner.color) : '#d8d0b0',
    isOwn: e.owner === localPlayerId,
    hp: Math.ceil(e.hp),
    maxHp: e.maxHp,
  };
  if (e.kind === 'unit') {
    const def = getUnitDefinition(e.type);
    const player = world.getPlayer(e.owner);
    const carry =
      def.gatherer && e.carryType && e.carryAmount > 0
        ? { resource: e.carryType, amount: e.carryAmount, capacity: def.gatherer.carryCapacity + (player?.modifiers.carryCapacity ?? 0) }
        : null;
    return {
      ...base,
      name: def.name,
      description: def.description,
      status: unitStatus(world, e),
      buildProgress: null,
      carry,
      stats: [
        { label: 'Ataque', value: String(def.attack) },
        { label: 'Armadura', value: `${def.armor.melee}/${def.armor.pierce}` },
        { label: 'Alcance', value: def.range === 0 ? 'Corpo a corpo' : String(def.range) },
        { label: 'Velocidade', value: def.speed.toFixed(1) },
        { label: 'Visão', value: String(def.lineOfSight) },
      ],
    };
  }
  if (e.kind === 'building') {
    const def = getBuildingDefinition(e.type);
    return {
      ...base,
      name: def.name,
      description: def.description,
      status: e.complete ? 'Concluído' : `Em construção — ${Math.floor(e.buildProgress * 100)}%`,
      carry: null,
      buildProgress: e.complete ? null : e.buildProgress,
      stats: [
        { label: 'Armadura', value: `${def.armor.melee}/${def.armor.pierce}` },
        { label: 'População', value: `+${def.populationProvided}` },
        { label: 'Visão', value: String(def.lineOfSight) },
      ],
    };
  }
  const def = RESOURCE_NODE_DEFINITIONS[e.nodeType];
  const gatherers = world.units.filter((u) => u.task?.targetId === e.id).length;
  return {
    ...base,
    name: def.name,
    description: `Fonte de ${RESOURCE_NAMES[def.resource]}. Selecione aldeões e clique com o botão direito para coletar.`,
    status: e.amount < e.initialAmount ? 'Sendo explorado' : 'Intacto',
    carry: null,
    buildProgress: null,
    stats: [
      { label: 'Restante', value: `${Math.floor(e.amount)} de ${RESOURCE_NAMES[def.resource]}` },
      { label: 'Coletores', value: String(gatherers) },
    ],
  };
}

function summarizeEconomy(world: World, localPlayerId: PlayerId, ratePerMinute: ResourceAmounts): EconomySummary {
  const workers: ResourceAmounts = { food: 0, wood: 0, gold: 0, stone: 0 };
  let idleVillagers = 0;
  for (const u of world.units) {
    if (u.owner !== localPlayerId || !getUnitDefinition(u.type).gatherer) continue;
    const resource = taskResource(u);
    if (resource) workers[resource]++;
    else if (u.state === 'idle') idleVillagers++;
  }
  const player = world.getPlayer(localPlayerId);
  return { workers, idleVillagers, gathered: player ? { ...player.stats.gathered } : { food: 0, wood: 0, gold: 0, stone: 0 }, ratePerMinute };
}

function buildOptions(world: World, entities: Entity[], localPlayerId: PlayerId): BuildOption[] {
  const hasBuilder = entities.some((e) => e.kind === 'unit' && e.owner === localPlayerId && getUnitDefinition(e.type).builder);
  if (!hasBuilder) return [];
  return BUILD_MENU.map((type) => {
    const def = getBuildingDefinition(type);
    const check = checkBuildingAvailability(world, localPlayerId, type, def);
    return {
      type,
      name: def.name,
      description: def.description,
      hotkey: def.hotkey ?? '',
      cost: def.cost,
      iconKey: buildingTexture(type, localPlayerId),
      available: check.ok,
      reason: check.ok ? undefined : check.reason,
    };
  });
}

export function buildHudSnapshot(world: World, selection: readonly EntityId[], localPlayerId: PlayerId, ratePerMinute: ResourceAmounts): HudSnapshot {
  const player = world.getPlayer(localPlayerId);
  const entities = selection.map((id) => world.getEntity(id)).filter((e): e is Entity => !!e);
  const groups = new Map<string, SelectionGroupInfo>();
  for (const e of entities) {
    const g = groups.get(e.type);
    if (g) g.count++;
    else groups.set(e.type, { type: e.type, name: describe(world, e, localPlayerId).name, count: 1, iconKey: iconKeyFor(e) });
  }
  return {
    time: world.time,
    playerName: player?.name ?? '',
    playerColor: player ? toCssColor(player.color) : '#fff',
    resources: player ? { ...player.resources } : { food: 0, wood: 0, gold: 0, stone: 0 },
    population: player?.population ?? 0,
    populationCap: player?.populationCap ?? 0,
    ageName: player ? AGE_NAMES[player.age] : '',
    economy: summarizeEconomy(world, localPlayerId, ratePerMinute),
    selection: {
      count: entities.length,
      primary: entities[0] ? describe(world, entities[0], localPlayerId) : null,
      groups: [...groups.values()],
      hasOwnUnits: entities.some((e) => e.kind === 'unit' && e.owner === localPlayerId),
      buildOptions: buildOptions(world, entities, localPlayerId),
    },
  };
}
