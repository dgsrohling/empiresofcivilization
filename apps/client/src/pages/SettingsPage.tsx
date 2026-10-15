import { ScreenFrame } from '../components/ScreenFrame';
import { SettingsPanel } from '../components/SettingsPanel';
import { useAppStore } from '../stores/appStore';

export function SettingsPage() {
  const go = useAppStore((s) => s.go);
  return (
    <ScreenFrame title="Configurações" onBack={() => go('menu')} width="max-w-xl">
      <SettingsPanel />
    </ScreenFrame>
  );
}
