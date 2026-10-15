import { CreditsPage } from './pages/CreditsPage';
import { GamePage } from './pages/GamePage';
import { MainMenu } from './pages/MainMenu';
import { NewGamePage } from './pages/NewGamePage';
import { SettingsPage } from './pages/SettingsPage';
import { TutorialPage } from './pages/TutorialPage';
import { useAppStore } from './stores/appStore';

export function App() {
  const screen = useAppStore((s) => s.screen);
  switch (screen) {
    case 'game':
      return <GamePage />;
    case 'newGame':
      return <NewGamePage />;
    case 'settings':
      return <SettingsPage />;
    case 'tutorial':
      return <TutorialPage />;
    case 'credits':
      return <CreditsPage />;
    default:
      return <MainMenu />;
  }
}
