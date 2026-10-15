import { useState } from 'react';
import { ControlsReference } from '../components/ControlsReference';
import { MedievalButton } from '../components/MedievalButton';
import { SettingsPanel } from '../components/SettingsPanel';

interface Props {
  seed: number;
  onResume: () => void;
  onRestartSame: () => void;
  onRestartNew: () => void;
  onExit: () => void;
}

/** Menu da partida (pausa a simulação enquanto aberto). */
export function GameMenu({ seed, onResume, onRestartSame, onRestartNew, onExit }: Props) {
  const [view, setView] = useState<'main' | 'settings' | 'controls'>('main');
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal aria-label="Menu da partida">
      <div className="panel-wood flex max-h-full w-full max-w-lg flex-col p-6">
        <h2 className="title-engraved mb-1 text-center text-2xl">Jogo pausado</h2>
        <p className="mb-4 text-center text-xs text-parchment-dim">Semente do mapa: {seed}</p>
        <div className="min-h-0 overflow-y-auto">
          {view === 'main' && (
            <div className="flex flex-col gap-2">
              <MedievalButton size="lg" onClick={onResume} autoFocus>
                Continuar
              </MedievalButton>
              <MedievalButton onClick={() => setView('settings')}>Configurações</MedievalButton>
              <MedievalButton onClick={() => setView('controls')}>Controles</MedievalButton>
              <MedievalButton onClick={onRestartSame}>Reiniciar (mesmo mapa)</MedievalButton>
              <MedievalButton onClick={onRestartNew}>Nova partida (novo mapa)</MedievalButton>
              <MedievalButton onClick={onExit}>Sair da partida</MedievalButton>
            </div>
          )}
          {view === 'settings' && <SettingsPanel />}
          {view === 'controls' && <ControlsReference />}
        </div>
        {view !== 'main' && (
          <div className="mt-4 flex justify-center">
            <MedievalButton onClick={() => setView('main')}>Voltar</MedievalButton>
          </div>
        )}
      </div>
    </div>
  );
}
