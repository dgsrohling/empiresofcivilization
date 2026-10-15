import { ResourceIcon } from '../components/ResourceIcon';
import type { GameSession } from '../game/GameSession';
import { RESOURCE_NAMES } from '../game/hudSnapshot';
import { useHudStore } from '../stores/hudStore';

function Icon({ session, iconKey, size = 56 }: { session: GameSession; iconKey: string; size?: number }) {
  const url = session.getIconUrl(iconKey);
  return (
    <div className="panel-inset flex shrink-0 items-center justify-center overflow-hidden" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} /> : null}
    </div>
  );
}

export function SelectionPanel({ session }: { session: GameSession }) {
  const selection = useHudStore((s) => s.snapshot?.selection);
  if (!selection || !selection.primary) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-parchment-dim" data-testid="selection-panel">
        Nenhuma seleção.
        <br />
        Clique em uma unidade ou arraste para selecionar várias.
      </div>
    );
  }

  if (selection.count > 1) {
    return (
      <div className="flex h-full flex-col gap-2" data-testid="selection-panel">
        <div className="font-display text-sm tracking-wide text-brass">{selection.count} unidades selecionadas</div>
        <div className="flex flex-wrap gap-2">
          {selection.groups.map((g) => (
            <button key={g.type} type="button" className="relative" title={`Selecionar apenas: ${g.name}`} onClick={() => session.selectOnlyType(g.type)}>
              <Icon session={session} iconKey={g.iconKey} size={48} />
              <span className="absolute -right-1 -bottom-1 rounded-sm bg-wood-950 px-1 font-mono text-xs text-parchment">{g.count}</span>
            </button>
          ))}
        </div>
        <div className="text-xs text-parchment-dim">Clique em um ícone para manter apenas aquele tipo.</div>
      </div>
    );
  }

  const p = selection.primary;
  const ratio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
  return (
    <div className="flex h-full gap-3" data-testid="selection-panel">
      <div className="flex flex-col items-center gap-1">
        <Icon session={session} iconKey={p.iconKey} size={64} />
        {p.kind !== 'resource' && (
          <div className="w-16">
            <div className="h-2 overflow-hidden rounded-sm bg-black/70">
              <div className="h-full" style={{ width: `${ratio * 100}%`, background: ratio > 0.5 ? '#4ccf5a' : ratio > 0.25 ? '#e0b030' : '#d8402f' }} />
            </div>
            <div className="text-center font-mono text-[11px]">
              {p.hp}/{p.maxHp}
            </div>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base tracking-wide text-brass" data-testid="selection-name">
            {p.name}
          </span>
          <span className="truncate text-xs" style={{ color: p.ownerColor }}>
            {p.ownerName}
          </span>
        </div>
        <div className="text-xs text-parchment-dim">{p.description}</div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
          {p.stats.map((s) => (
            <div key={s.label}>
              <span className="text-parchment-dim">{s.label}: </span>
              <span className="font-mono">{s.value}</span>
            </div>
          ))}
        </div>
        {p.queue.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1" data-testid="training-queue">
            {p.queue.map((item, i) => (
              <button
                key={i}
                type="button"
                className="relative"
                title={`${item.name} — clique para cancelar (devolve o custo)`}
                onClick={() => session.cancelTrain(i)}
              >
                <Icon session={session} iconKey={item.iconKey} size={i === 0 ? 34 : 26} />
                {i === 0 && (
                  <span className="absolute inset-x-0.5 bottom-0.5 h-1 bg-black/70">
                    <span className="block h-full bg-brass" style={{ width: `${item.progress * 100}%` }} />
                  </span>
                )}
              </button>
            ))}
            {p.queueBlocked && <span className="ml-1 text-xs text-red-300">População máxima — construa casas</span>}
          </div>
        )}
        <div className="mt-auto flex items-center gap-4 text-xs">
          <span>
            <span className="text-parchment-dim">Estado: </span>
            <span data-testid="selection-status">{p.status}</span>
          </span>
          {p.carry && (
            <span className="flex items-center gap-1" data-testid="selection-carry" title="Carga atual">
              <ResourceIcon type={p.carry.resource} size={14} />
              <span className="font-mono">
                {p.carry.amount}/{p.carry.capacity}
              </span>
              <span className="text-parchment-dim">{RESOURCE_NAMES[p.carry.resource]}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
