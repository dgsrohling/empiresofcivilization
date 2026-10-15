import { RESOURCE_TYPES } from '@eoc/shared';
import { ResourceIcon } from '../components/ResourceIcon';
import type { GameSession } from '../game/GameSession';
import type { BuildOption } from '../game/hudSnapshot';
import { useHudStore } from '../stores/hudStore';

function CommandButton({ label, hotkey, onClick, children, disabled }: { label: string; hotkey: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="btn-medieval relative h-12 w-12 p-0"
      title={hotkey ? `${label} (${hotkey})` : label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      {hotkey && <span className="absolute right-0.5 bottom-0 font-mono text-[9px] text-parchment-dim">{hotkey}</span>}
    </button>
  );
}

function CostLine({ cost }: { cost: BuildOption['cost'] }) {
  return (
    <span className="flex gap-2">
      {RESOURCE_TYPES.filter((r) => cost[r]).map((r) => (
        <span key={r} className="flex items-center gap-0.5 font-mono">
          <ResourceIcon type={r} size={11} />
          {cost[r]}
        </span>
      ))}
    </span>
  );
}

function BuildMenu({ session, options }: { session: GameSession; options: BuildOption[] }) {
  const close = useHudStore((s) => s.setBuildMenuOpen);
  return (
    <div className="flex h-full flex-col gap-1.5" data-testid="build-menu">
      <div className="flex items-center justify-between">
        <span className="font-display text-xs tracking-wider text-brass">Construir</span>
        <button type="button" className="text-xs text-parchment-dim hover:text-parchment" onClick={() => close(false)}>
          Voltar (Esc)
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const url = session.getIconUrl(o.iconKey);
          return (
            <button
              key={o.type}
              type="button"
              className="btn-medieval group relative h-12 w-12 p-0.5"
              disabled={!o.available}
              onClick={() => session.beginPlacement(o.type)}
              aria-label={`Construir ${o.name}`}
              data-testid={`build-${o.type}`}
            >
              {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />}
              {o.hotkey && <span className="absolute right-0.5 bottom-0 font-mono text-[9px] text-parchment-dim">{o.hotkey}</span>}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-52 -translate-x-1/2 panel-wood p-2 text-left text-[11px] leading-snug group-hover:block">
                <span className="block font-display text-xs text-brass">
                  {o.name} {o.hotkey && <span className="text-parchment-dim">({o.hotkey})</span>}
                </span>
                <span className="my-1 block">
                  <CostLine cost={o.cost} />
                </span>
                <span className="block text-parchment-dim">{o.description}</span>
                {!o.available && o.reason && <span className="mt-1 block text-red-300">{o.reason}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Apenas comandos realmente implementados são exibidos. */
export function CommandPanel({ session }: { session: GameSession }) {
  const selection = useHudStore((s) => s.snapshot?.selection);
  const buildMenuOpen = useHudStore((s) => s.buildMenuOpen);
  const hasOwn = !!selection?.hasOwnUnits;
  const builders = selection?.buildOptions ?? [];
  const isVillager = builders.length > 0;
  const carrying = !!selection?.primary?.carry || (selection?.count ?? 0) > 1;
  const primary = selection?.primary;
  const ownSite = selection?.count === 1 && primary?.kind === 'building' && primary.isOwn && primary.buildProgress !== null;

  if (buildMenuOpen && isVillager) return <BuildMenu session={session} options={builders} />;

  return (
    <div className="flex h-full flex-col gap-2" data-testid="command-panel">
      <div className="font-display text-xs tracking-wider text-brass">Comandos</div>
      {ownSite && (
        <div className="flex flex-wrap gap-1.5">
          <CommandButton label="Cancelar construção" hotkey="Del" onClick={() => session.cancelSelectedConstruction()}>
            <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
              <path d="M4 4l12 12M16 4L4 16" stroke="#e05a4a" strokeWidth="2.5" />
            </svg>
          </CommandButton>
          <p className="w-full text-xs leading-snug text-parchment-dim">Devolve o custo proporcional ao que falta construir. Selecione aldeões e clique com o botão direito na obra para ajudar.</p>
        </div>
      )}
      {hasOwn && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {isVillager && (
              <CommandButton label="Construir" hotkey="B" onClick={() => session.toggleBuildMenu()}>
                <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
                  <path d="M3 17l8-8" stroke="#c9a46a" strokeWidth="2.5" />
                  <path d="M9 3l6 2-2 4-6-2z" fill="#9aa0a6" stroke="#f1e3bf" strokeWidth="1" />
                </svg>
              </CommandButton>
            )}
            <CommandButton label="Parar" hotkey="S" onClick={() => session.stopSelected()}>
              <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
                <path d="M6 1h8l5 5v8l-5 5H6l-5-5V6z" fill="#a8352a" stroke="#f1e3bf" strokeWidth="1.2" />
                <rect x="6" y="9" width="8" height="2" fill="#f1e3bf" />
              </svg>
            </CommandButton>
            <CommandButton label="Centralizar câmera" hotkey="␣" onClick={() => session.centerOnSelection()}>
              <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
                <circle cx="10" cy="10" r="6" fill="none" stroke="#f1e3bf" strokeWidth="1.5" />
                <path d="M10 1v5M10 14v5M1 10h5M14 10h5" stroke="#f1e3bf" strokeWidth="1.5" />
              </svg>
            </CommandButton>
            {isVillager && carrying && (
              <CommandButton label="Depositar carga no depósito mais próximo" hotkey="" onClick={() => session.depositSelected()}>
                <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
                  <path d="M3 9l7-6 7 6v9H3z" fill="#8a5a2e" stroke="#f1e3bf" strokeWidth="1.2" />
                  <path d="M10 6v7M7 10l3 3 3-3" stroke="#f1e3bf" strokeWidth="1.5" fill="none" />
                </svg>
              </CommandButton>
            )}
          </div>
          <p className="text-xs leading-snug text-parchment-dim">
            {isVillager
              ? 'Botão direito: recursos para coletar, Centro da Vila para depositar, obras para construir.'
              : 'Clique direito no mapa para mover. Ctrl+número cria um grupo de controle.'}
          </p>
        </>
      )}
      {!hasOwn && !ownSite && (
        <p className="text-xs text-parchment-dim">{primary ? 'Sem comandos disponíveis para esta seleção.' : 'Selecione unidades suas para ver os comandos.'}</p>
      )}
    </div>
  );
}
