import { useSettingsStore } from '../stores/settingsStore';

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="panel-inset flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
      <span>
        <span className="block font-display text-sm tracking-wide">{label}</span>
        <span className="block text-xs text-parchment-dim">{hint}</span>
      </span>
      <input type="checkbox" className="h-5 w-5 accent-[#d9ad4c]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Configurações funcionais (persistidas no navegador). Usado no menu e durante a partida. */
export function SettingsPanel() {
  const s = useSettingsStore();
  return (
    <div className="flex flex-col gap-3">
      <Toggle label="Rolagem pelas bordas" hint="Move a câmera ao aproximar o cursor das bordas da tela." checked={s.edgeScroll} onChange={(edgeScroll) => s.update({ edgeScroll })} />
      <Toggle label="Mostrar caminhos" hint="Exibe o trajeto planejado das unidades selecionadas." checked={s.showPaths} onChange={(showPaths) => s.update({ showPaths })} />
      <Toggle label="Mostrar FPS" hint="Exibe a taxa de quadros na barra superior." checked={s.showFps} onChange={(showFps) => s.update({ showFps })} />
      <label className="panel-inset flex items-center justify-between gap-4 px-4 py-3">
        <span>
          <span className="block font-display text-sm tracking-wide">Velocidade da câmera</span>
          <span className="block text-xs text-parchment-dim">{Math.round(s.cameraSpeed * 100)}%</span>
        </span>
        <input type="range" min={0.4} max={2} step={0.1} value={s.cameraSpeed} onChange={(e) => s.update({ cameraSpeed: Number(e.target.value) })} className="w-40 accent-[#d9ad4c]" />
      </label>
      <p className="text-xs text-parchment-dim">Áudio: controles de música e efeitos serão adicionados com o sistema de som (Fase 8).</p>
    </div>
  );
}
