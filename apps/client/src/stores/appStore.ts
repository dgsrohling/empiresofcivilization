import type { MapSizeId } from '@eoc/shared';
import { create } from 'zustand';

export type Screen = 'menu' | 'newGame' | 'settings' | 'tutorial' | 'credits' | 'game';

export interface MatchOptions {
  seed: number;
  mapSize: MapSizeId;
}

interface AppState {
  screen: Screen;
  /** Tela para a qual "Voltar" retorna em Configurações (menu ou partida). */
  returnTo: Screen;
  match: MatchOptions | null;
  /** Incrementado para recriar a partida sem recarregar a página. */
  matchKey: number;
  go: (screen: Screen) => void;
  startMatch: (options: MatchOptions) => void;
  exitMatch: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'menu',
  returnTo: 'menu',
  match: null,
  matchKey: 0,
  go: (screen) => set((s) => ({ screen, returnTo: screen === 'settings' ? s.screen : s.returnTo })),
  startMatch: (match) => set((s) => ({ match, screen: 'game', matchKey: s.matchKey + 1 })),
  exitMatch: () => set({ match: null, screen: 'menu' }),
}));
