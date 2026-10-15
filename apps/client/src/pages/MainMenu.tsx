import { MedievalButton } from '../components/MedievalButton';
import { useAppStore } from '../stores/appStore';

export function MainMenu() {
  const go = useAppStore((s) => s.go);
  return (
    <div className="menu-backdrop relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-4">
      <CastleSilhouette />
      <div className="relative z-10 flex flex-col items-center">
        <p className="mb-1 font-display text-xs tracking-[0.4em] text-brass-dim">ESTRATÉGIA EM TEMPO REAL</p>
        <h1 className="title-engraved text-center text-4xl sm:text-6xl">Empires of Civilization</h1>
        <div className="my-5 h-px w-72 bg-gradient-to-r from-transparent via-brass to-transparent" />
        <nav className="panel-wood flex w-80 flex-col gap-2.5 p-5" aria-label="Menu principal">
          <MedievalButton size="lg" onClick={() => go('newGame')} autoFocus>
            Jogar
          </MedievalButton>
          <MedievalButton disabled badge="Fase 5" title="A IA adversária será implementada na Fase 5">
            Partida contra IA
          </MedievalButton>
          <MedievalButton disabled badge="Fase 7" title="O multiplayer será implementado na Fase 7">
            Multiplayer
          </MedievalButton>
          <MedievalButton disabled badge="Em breve" title="Salvamento em IndexedDB ainda não implementado">
            Carregar partida
          </MedievalButton>
          <MedievalButton onClick={() => go('settings')}>Configurações</MedievalButton>
          <MedievalButton onClick={() => go('tutorial')}>Tutorial e controles</MedievalButton>
          <MedievalButton onClick={() => go('credits')}>Créditos</MedievalButton>
        </nav>
        <p className="mt-6 text-xs text-parchment-dim/70">Versão 0.3.0 · Protótipo da Fase 3</p>
      </div>
    </div>
  );
}

/** Silhueta decorativa original (SVG) no fundo do menu. */
function CastleSilhouette() {
  return (
    <svg className="pointer-events-none absolute bottom-0 left-1/2 w-[1400px] max-w-none -translate-x-1/2 opacity-40" viewBox="0 0 1400 260" aria-hidden>
      <path
        fill="#0a0d09"
        d="M0 260V200l60-20 50 10 40-30 70 15 40-25 30 10V110h14V96h12v14h14V90h12v20h14V96h12v14h14v50l40-10 30 15V120h20v-14h14v14h14V86l18-26 18 26v34h14v-14h14v14h20v40l40 12 50-18 60 14V140h12v-12h14v12h12v-12h14v12h12v54l50-14 40 10 60-24 50 16 70-10 60 20 50-14 60 18 70-6v80z"
      />
      <path fill="#d9ad4c" opacity="0.6" d="M553 60l-1 -30 26 8 -25 8z" />
    </svg>
  );
}
