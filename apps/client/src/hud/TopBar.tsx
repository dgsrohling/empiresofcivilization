import { RESOURCE_TYPES } from '@eoc/shared';
import { PopulationIcon, ResourceIcon, VillagerIcon } from '../components/ResourceIcon';
import { useHudStore } from '../stores/hudStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatTime } from './format';

export const RESOURCE_LABELS = { food: 'Comida', wood: 'Madeira', gold: 'Ouro', stone: 'Pedra' } as const;

interface Props {
  onMenu: () => void;
  onIdleVillager: () => void;
}

export function TopBar({ onMenu, onIdleVillager }: Props) {
  const snapshot = useHudStore((s) => s.snapshot);
  const fps = useHudStore((s) => s.fps);
  const economyOpen = useHudStore((s) => s.economyOpen);
  const toggleEconomy = useHudStore((s) => s.toggleEconomy);
  const showFps = useSettingsStore((s) => s.showFps);
  if (!snapshot) return null;
  const { economy } = snapshot;
  const popFull = snapshot.population >= snapshot.populationCap;
  return (
    <div className="panel-wood pointer-events-auto absolute inset-x-0 top-0 flex h-10 items-center gap-1 rounded-none border-x-0 border-t-0 px-2 text-sm" data-testid="top-bar">
      {RESOURCE_TYPES.map((type) => (
        <div
          key={type}
          className="panel-inset flex h-7 min-w-[104px] items-center gap-1.5 px-2"
          title={`${RESOURCE_LABELS[type]} — ${economy.workers[type]} aldeão(ões) coletando`}
          data-testid={`resource-${type}`}
        >
          <ResourceIcon type={type} />
          <span className="font-mono tabular-nums" data-testid={`resource-${type}-amount`}>
            {Math.floor(snapshot.resources[type])}
          </span>
          <span className="ml-auto flex items-center gap-0.5 font-mono text-[11px] text-parchment-dim">
            <VillagerIcon size={11} />
            {economy.workers[type]}
          </span>
        </div>
      ))}
      <div className={`panel-inset flex h-7 min-w-[86px] items-center gap-1.5 px-2 ${popFull ? 'text-red-300' : ''}`} title="População / Limite">
        <PopulationIcon />
        <span className="font-mono tabular-nums">
          {snapshot.population}/{snapshot.populationCap}
        </span>
      </div>
      <button
        type="button"
        onClick={onIdleVillager}
        className={`panel-inset flex h-7 items-center gap-1 px-2 font-mono text-xs transition hover:border-brass ${economy.idleVillagers > 0 ? 'animate-pulse text-amber-200' : 'text-parchment-dim'}`}
        title="Aldeões ociosos — clique ou tecla . (ponto) para selecionar o próximo"
        data-testid="idle-villagers"
      >
        <VillagerIcon size={14} />
        {economy.idleVillagers} ociosos
      </button>
      <div className="mx-auto flex items-center gap-3 font-display text-xs tracking-wider">
        <span className="hidden text-brass lg:inline">{snapshot.ageName}</span>
        <span className="panel-inset px-2 py-1 font-mono text-sm tabular-nums" title="Tempo de partida" data-testid="match-time">
          {formatTime(snapshot.time)}
        </span>
      </div>
      {showFps && <span className="mr-2 font-mono text-xs text-parchment-dim">{fps} FPS</span>}
      <button type="button" className={`btn-medieval mr-1 px-3 py-1 text-xs ${economyOpen ? 'border-brass' : ''}`} onClick={toggleEconomy} aria-pressed={economyOpen}>
        Economia
      </button>
      <button type="button" className="btn-medieval px-3 py-1 text-xs" onClick={onMenu}>
        Menu (F10)
      </button>
    </div>
  );
}
