import { MAP_SIZES, type MapSizeId } from '@eoc/shared';
import { randomSeed, seedFromString } from '@eoc/simulation';
import { useState } from 'react';
import { MedievalButton } from '../components/MedievalButton';
import { ScreenFrame } from '../components/ScreenFrame';
import { useAppStore } from '../stores/appStore';

const SIZE_LABELS: Record<MapSizeId, string> = { small: 'Pequeno', medium: 'Médio', large: 'Grande' };

export function NewGamePage() {
  const { go, startMatch } = useAppStore();
  const [mapSize, setMapSize] = useState<MapSizeId>('medium');
  const [seedText, setSeedText] = useState(() => String(randomSeed()));
  const [sandbox, setSandbox] = useState(false);

  const start = () => startMatch({ mapSize, seed: seedFromString(seedText || '0'), sandbox });

  return (
    <ScreenFrame title="Nova Partida" onBack={() => go('menu')}>
      <div className="flex flex-col gap-5">
        <section>
          <h2 className="mb-2 font-display text-sm tracking-wider text-brass">Tamanho do mapa</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(MAP_SIZES) as MapSizeId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setMapSize(id)}
                className={`panel-inset px-3 py-3 text-center transition ${mapSize === id ? 'outline-2 outline-brass' : 'opacity-75 hover:opacity-100'}`}
                aria-pressed={mapSize === id}
              >
                <span className="block font-display text-sm">{SIZE_LABELS[id]}</span>
                <span className="block text-xs text-parchment-dim">
                  {MAP_SIZES[id]} × {MAP_SIZES[id]}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-display text-sm tracking-wider text-brass">Semente do mapa</h2>
          <div className="flex gap-2">
            <input
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              className="panel-inset min-w-0 flex-1 px-3 py-2 font-mono text-sm text-parchment outline-none focus:border-brass"
              aria-label="Semente do mapa"
            />
            <MedievalButton onClick={() => setSeedText(String(randomSeed()))}>Aleatória</MedievalButton>
          </div>
          <p className="mt-1 text-xs text-parchment-dim">A mesma semente sempre gera o mesmo mapa. Textos também são aceitos.</p>
        </section>
        <label className="panel-inset flex cursor-pointer items-center justify-between gap-4 px-3 py-2">
          <span>
            <span className="block font-display text-sm">Modo de teste</span>
            <span className="block text-xs text-parchment-dim">Controle os dois lados, alternando com F9 — útil para testar combate antes da IA (Fase 5).</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-[#d9ad4c]" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} data-testid="sandbox-toggle" />
        </label>
        <section className="panel-inset p-3 text-sm">
          <p>
            <span className="text-brass">Você:</span> Reino de Valdoria (azul) — Centro da Vila, 5 aldeões e 1 batedor.
          </p>
          <p>
            <span className="text-brass">Rival:</span> Império de Arkan (vermelho) — sem IA nesta fase: as unidades dele apenas se defendem.
          </p>
          <p className="mt-2 text-xs text-parchment-dim">
            Fase 4: economia, construção, treinamento de unidades e combate. A IA adversária chega na Fase 5.
          </p>
        </section>
        <MedievalButton size="lg" onClick={start}>
          Iniciar partida
        </MedievalButton>
      </div>
    </ScreenFrame>
  );
}
