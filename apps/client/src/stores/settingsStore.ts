import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface SettingsState {
  edgeScroll: boolean;
  showPaths: boolean;
  showFps: boolean;
  cameraSpeed: number;
  update: (patch: Partial<Omit<SettingsState, 'update'>>) => void;
}

/** Armazenamento tolerante a falhas (modo privado, cookies bloqueados etc.). */
const safeStorage = createJSONStorage(() => ({
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignora */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignora */
    }
  },
}));

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      edgeScroll: true,
      showPaths: true,
      showFps: false,
      cameraSpeed: 1,
      update: (patch) => set(patch),
    }),
    { name: 'eoc-settings', storage: safeStorage, version: 1 },
  ),
);
