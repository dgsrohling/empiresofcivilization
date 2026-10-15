import { ScreenFrame } from '../components/ScreenFrame';
import { useAppStore } from '../stores/appStore';

export function CreditsPage() {
  const go = useAppStore((s) => s.go);
  return (
    <ScreenFrame title="Créditos" onBack={() => go('menu')} width="max-w-lg">
      <div className="flex flex-col gap-3 text-center text-sm">
        <p>
          <span className="font-display text-brass">Empires of Civilization</span>
          <br />
          Projeto original de estratégia em tempo real.
        </p>
        <p>
          Gráficos provisórios gerados proceduralmente pelo próprio jogo.
          <br />
          Nenhum asset de terceiros protegido é utilizado.
        </p>
        <p className="text-parchment-dim">
          Tecnologias: React, Phaser 3, TypeScript, Vite, Tailwind CSS, Zustand e Vitest.
        </p>
      </div>
    </ScreenFrame>
  );
}
