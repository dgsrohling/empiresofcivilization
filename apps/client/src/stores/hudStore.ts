import { create } from 'zustand';
import type { HudSnapshot } from '../game/hudSnapshot';

export interface Notification {
  id: number;
  text: string;
}

interface HudState {
  snapshot: HudSnapshot | null;
  fps: number;
  notification: Notification | null;
  menuOpen: boolean;
  economyOpen: boolean;
  buildMenuOpen: boolean;
  /** Nome do edifício sendo posicionado (null fora do modo de posicionamento). */
  placing: string | null;
  setSnapshot: (snapshot: HudSnapshot, fps: number) => void;
  notify: (text: string) => void;
  setMenuOpen: (open: boolean) => void;
  toggleEconomy: () => void;
  setBuildMenuOpen: (open: boolean) => void;
  setPlacing: (name: string | null) => void;
  reset: () => void;
}

let nextNotification = 1;

/**
 * Estado do HUD atualizado em baixa frequência (~5 Hz) pela cena do jogo.
 * Posições de unidades NÃO passam pelo React.
 */
export const useHudStore = create<HudState>((set) => ({
  snapshot: null,
  fps: 0,
  notification: null,
  menuOpen: false,
  economyOpen: false,
  buildMenuOpen: false,
  placing: null,
  setSnapshot: (snapshot, fps) => set({ snapshot, fps }),
  notify: (text) => set({ notification: { id: nextNotification++, text } }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  toggleEconomy: () => set((s) => ({ economyOpen: !s.economyOpen })),
  setBuildMenuOpen: (buildMenuOpen) => set({ buildMenuOpen }),
  setPlacing: (placing) => set({ placing }),
  reset: () => set({ snapshot: null, notification: null, menuOpen: false, buildMenuOpen: false, placing: null }),
}));
