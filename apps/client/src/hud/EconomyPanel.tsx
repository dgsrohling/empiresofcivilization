import { RESOURCE_TYPES } from '@eoc/shared';
import { ResourceIcon } from '../components/ResourceIcon';
import { useHudStore } from '../stores/hudStore';
import { RESOURCE_LABELS } from './TopBar';

/** Resumo econômico: estoque, aldeões por recurso, total coletado e ritmo do último minuto. */
export function EconomyPanel() {
  const snapshot = useHudStore((s) => s.snapshot);
  const open = useHudStore((s) => s.economyOpen);
  if (!open || !snapshot) return null;
  const { economy, resources } = snapshot;
  return (
    <div className="panel-wood pointer-events-auto absolute top-12 right-2 w-[340px] p-3 text-sm" data-testid="economy-panel">
      <h3 className="mb-2 font-display text-sm tracking-wider text-brass">Economia</h3>
      <table className="w-full text-xs">
        <thead className="text-parchment-dim">
          <tr>
            <th className="pb-1 text-left font-normal">Recurso</th>
            <th className="pb-1 text-right font-normal">Estoque</th>
            <th className="pb-1 text-right font-normal">Aldeões</th>
            <th className="pb-1 text-right font-normal">Coletado</th>
            <th className="pb-1 text-right font-normal">Ritmo/min</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {RESOURCE_TYPES.map((type) => (
            <tr key={type} className="border-t border-wood-700/60">
              <td className="flex items-center gap-1.5 py-1 font-body">
                <ResourceIcon type={type} size={14} />
                {RESOURCE_LABELS[type]}
              </td>
              <td className="py-1 text-right">{Math.floor(resources[type])}</td>
              <td className="py-1 text-right">{economy.workers[type]}</td>
              <td className="py-1 text-right">{economy.gathered[type]}</td>
              <td className="py-1 text-right">{economy.ratePerMinute[type]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-parchment-dim">
        Aldeões ociosos: <span className="font-mono text-parchment">{economy.idleVillagers}</span>. O ritmo considera os depósitos do último minuto de jogo.
      </p>
    </div>
  );
}
