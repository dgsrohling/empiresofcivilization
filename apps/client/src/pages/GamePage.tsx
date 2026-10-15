import { randomSeed } from '@eoc/simulation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MedievalButton } from '../components/MedievalButton';
import { GameSession } from '../game/GameSession';
import { CommandPanel } from '../hud/CommandPanel';
import { EconomyPanel } from '../hud/EconomyPanel';
import { GameMenu } from '../hud/GameMenu';
import { Minimap } from '../hud/Minimap';
import { PlacementHint } from '../hud/PlacementHint';
import { SelectionPanel } from '../hud/SelectionPanel';
import { Toast } from '../hud/Toast';
import { TopBar } from '../hud/TopBar';
import { useAppStore } from '../stores/appStore';
import { useHudStore } from '../stores/hudStore';

declare global {
  interface Window {
    __EOC__?: GameSession;
  }
}

const DEBUG = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');

export function GamePage() {
  const match = useAppStore((s) => s.match);
  const matchKey = useAppStore((s) => s.matchKey);
  const startMatch = useAppStore((s) => s.startMatch);
  const exitMatch = useAppStore((s) => s.exitMatch);
  const menuOpen = useHudStore((s) => s.menuOpen);
  const setMenuOpen = useHudStore((s) => s.setMenuOpen);
  const containerRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  sessionRef.current = session;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!match || !container) return;
    useHudStore.getState().reset();
    setError(null);
    let created: GameSession;
    try {
      created = new GameSession(container, match);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSession(created);
    if (DEBUG) window.__EOC__ = created;
    return () => {
      created.destroy();
      if (window.__EOC__ === created) delete window.__EOC__;
      setSession(null);
    };
  }, [match, matchKey]);

  useEffect(() => {
    session?.setPaused(menuOpen);
  }, [session, menuOpen]);

  const toggleMenu = useCallback(() => setMenuOpen(!useHudStore.getState().menuOpen), [setMenuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F10') {
        e.preventDefault();
        toggleMenu();
      } else if (e.code === 'F9' && !useHudStore.getState().menuOpen) {
        e.preventDefault();
        sessionRef.current?.switchPlayer();
      } else if (e.code === 'Escape' && useHudStore.getState().menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMenu, setMenuOpen]);

  if (!match) return null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black" onContextMenu={(e) => e.preventDefault()}>
      <div ref={containerRef} className="absolute inset-0" data-testid="game-canvas" />
      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
          <div className="panel-wood max-w-md p-6 text-center">
            <h2 className="title-engraved mb-2 text-xl">Falha ao iniciar a partida</h2>
            <p className="mb-4 text-sm text-parchment-dim">{error}</p>
            <MedievalButton onClick={exitMatch}>Voltar ao menu</MedievalButton>
          </div>
        </div>
      )}
      {session && (
        <div className="pointer-events-none absolute inset-0 select-none">
          <TopBar onMenu={toggleMenu} onIdleVillager={() => session.selectNextIdleVillager()} sandbox={match.sandbox} />
          <EconomyPanel />
          <PlacementHint />
          <Toast />
          <div className="panel-wood pointer-events-auto absolute inset-x-0 bottom-0 flex h-[156px] gap-2 rounded-none border-x-0 border-b-0 p-2">
            <div className="panel-inset flex shrink-0 items-center justify-center p-1">
              <Minimap session={session} />
            </div>
            <div className="panel-inset min-w-0 flex-1 p-2">
              <SelectionPanel session={session} />
            </div>
            <div className="panel-inset w-56 shrink-0 p-2">
              <CommandPanel session={session} />
            </div>
          </div>
          {menuOpen && (
            <GameMenu
              seed={match.seed}
              onResume={() => setMenuOpen(false)}
              onRestartSame={() => {
                setMenuOpen(false);
                startMatch({ ...match });
              }}
              onRestartNew={() => {
                setMenuOpen(false);
                startMatch({ ...match, seed: randomSeed() });
              }}
              onExit={() => {
                setMenuOpen(false);
                exitMatch();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
