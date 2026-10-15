import { useHudStore } from '../stores/hudStore';

export function PlacementHint() {
  const placing = useHudStore((s) => s.placing);
  if (!placing) return null;
  return (
    <div className="panel-wood pointer-events-none absolute bottom-[166px] left-1/2 -translate-x-1/2 px-4 py-1.5 text-sm" data-testid="placement-hint">
      <span className="font-display text-brass">{placing}</span>
      <span className="text-parchment-dim"> — clique para posicionar · Shift mantém e enfileira · Esc ou botão direito cancela</span>
    </div>
  );
}
