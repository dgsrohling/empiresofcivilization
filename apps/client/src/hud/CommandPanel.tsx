import { RESOURCE_TYPES, type StanceId } from '@eoc/shared';
import type { ReactNode } from 'react';
import { ResourceIcon } from '../components/ResourceIcon';
import type { GameSession } from '../game/GameSession';
import { STANCE_NAMES, type BuildOption, type TrainOption } from '../game/hudSnapshot';
import { useHudStore } from '../stores/hudStore';

interface ButtonProps {
  label: string;
  hotkey: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  active?: boolean;
  testId?: string;
}

function CommandButton({ label, hotkey, onClick, children, disabled, active, testId }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn-medieval relative h-12 w-12 p-0 ${active ? 'border-brass brightness-125' : ''}`}
      title={hotkey ? `${label} (${hotkey})` : label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
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

/** Botão com ícone de textura do jogo e dica com custo/descrição/motivo de indisponibilidade. */
function IconOption({ session, option, onClick, testId, extra }: { session: GameSession; option: BuildOption | TrainOption; onClick: () => void; testId: string; extra?: string }) {
  const url = session.getIconUrl(option.iconKey);
  return (
    <button
      type="button"
      className="btn-medieval group relative h-12 w-12 p-0.5"
      disabled={!option.available}
      onClick={onClick}
      aria-label={option.name}
      data-testid={testId}
    >
      {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />}
      {option.hotkey && <span className="absolute right-0.5 bottom-0 font-mono text-[9px] text-parchment-dim">{option.hotkey}</span>}
      <span className="pointer-events-none absolute right-0 bottom-full z-10 mb-2 hidden w-56 panel-wood p-2 text-left text-[11px] leading-snug group-hover:block">
        <span className="block font-display text-xs text-brass">
          {option.name} {option.hotkey && <span className="text-parchment-dim">({option.hotkey})</span>}
        </span>
        <span className="my-1 block">
          <CostLine cost={option.cost} />
        </span>
        {extra && <span className="block text-parchment-dim">{extra}</span>}
        <span className="block text-parchment-dim">{option.description}</span>
        {!option.available && option.reason && <span className="mt-1 block text-red-300">{option.reason}</span>}
      </span>
    </button>
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
        {options.map((o) => (
          <IconOption key={o.type} session={session} option={o} onClick={() => session.beginPlacement(o.type)} testId={`build-${o.type}`} />
        ))}
      </div>
    </div>
  );
}

const STANCE_ICONS: Record<StanceId, ReactNode> = {
  aggressive: <path d="M4 16L16 4M11 4h5v5" stroke="#f1e3bf" strokeWidth="2" fill="none" />,
  defensive: <path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5z" fill="#2f6fd6" stroke="#f1e3bf" strokeWidth="1.2" />,
  holdPosition: <path d="M5 3v14M5 4h10l-3 3 3 3H5" stroke="#f1e3bf" strokeWidth="1.6" fill="#a8352a" />,
};

/** Apenas comandos realmente implementados são exibidos. */
export function CommandPanel({ session }: { session: GameSession }) {
  const selection = useHudStore((s) => s.snapshot?.selection);
  const buildMenuOpen = useHudStore((s) => s.buildMenuOpen);
  const attackMoveArmed = useHudStore((s) => s.attackMoveArmed);
  const hasOwn = !!selection?.hasOwnUnits;
  const builders = selection?.buildOptions ?? [];
  const isVillager = builders.length > 0;
  const carrying = !!selection?.primary?.carry || (selection?.count ?? 0) > 1;
  const primary = selection?.primary;
  const ownBuilding = selection?.count === 1 && primary?.kind === 'building' && primary.isOwn;
  const ownSite = ownBuilding && primary?.buildProgress !== null;
  const trainOptions = ownBuilding ? (primary?.trainOptions ?? []) : [];

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
      {trainOptions.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5" data-testid="train-options">
            {trainOptions.map((o) => (
              <IconOption key={o.type} session={session} option={o} onClick={() => session.train(o.type)} testId={`train-${o.type}`} extra={`Treino: ${o.trainTime} s`} />
            ))}
          </div>
          <p className="text-xs leading-snug text-parchment-dim">Botão direito no mapa define o ponto de reunião (em um recurso, aldeões começam a coletar).</p>
        </>
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
            {selection?.hasFighters && (
              <CommandButton label="Atacar-mover" hotkey="A" onClick={() => session.armAttackMove()} active={attackMoveArmed} testId="cmd-attack-move">
                <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
                  <path d="M3 17L14 6M10 4h6v6" stroke="#f1e3bf" strokeWidth="2" fill="none" />
                  <path d="M3 13l4 4" stroke="#e05a4a" strokeWidth="2" />
                </svg>
              </CommandButton>
            )}
            <CommandButton label="Parar" hotkey="S" onClick={() => session.stopSelected()}>
              <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden>
                <path d="M6 1h8l5 5v8l-5 5H6l-5-5V6z" fill="#a8352a" stroke="#f1e3bf" strokeWidth="1.2" />
                <rect x="6" y="9" width="8" height="2" fill="#f1e3bf" />
              </svg>
            </CommandButton>
            {selection?.hasFighters &&
              (['aggressive', 'defensive', 'holdPosition'] as const).map((stance) => (
                <CommandButton
                  key={stance}
                  label={`Postura: ${STANCE_NAMES[stance]}`}
                  hotkey={stance === 'holdPosition' ? 'H' : ''}
                  onClick={() => session.setStance(stance)}
                  active={selection.stance === stance}
                  testId={`stance-${stance}`}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                    {STANCE_ICONS[stance]}
                  </svg>
                </CommandButton>
              ))}
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
            {attackMoveArmed
              ? 'Clique no mapa para atacar-mover (Esc cancela).'
              : isVillager
                ? 'Botão direito: recursos (coletar), obras (construir), edifícios danificados (reparar), inimigos (atacar).'
                : 'Botão direito: mover ou atacar. A: atacar-mover. H: manter posição.'}
          </p>
        </>
      )}
      {!hasOwn && !ownSite && trainOptions.length === 0 && (
        <p className="text-xs text-parchment-dim">{primary ? 'Sem comandos disponíveis para esta seleção.' : 'Selecione unidades suas para ver os comandos.'}</p>
      )}
    </div>
  );
}
