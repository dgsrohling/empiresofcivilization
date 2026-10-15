import type { ResourceType } from '@eoc/shared';

/** Ícones vetoriais originais para os recursos. */
export function ResourceIcon({ type, size = 18 }: { type: ResourceType; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 20 20', 'aria-hidden': true } as const;
  switch (type) {
    case 'food':
      return (
        <svg {...common}>
          <circle cx="9" cy="11" r="6.5" fill="#c8402f" stroke="#5a160e" />
          <path d="M9 5c0-2 1-3 3-3" stroke="#4a2e14" strokeWidth="1.5" fill="none" />
          <path d="M11 4c2-1 4 0 4 1-2 1-3 0-4-1z" fill="#5aa040" />
          <circle cx="7" cy="9" r="1.5" fill="#f08a7a" />
        </svg>
      );
    case 'wood':
      return (
        <svg {...common}>
          <rect x="2" y="7" width="16" height="7" rx="3.5" fill="#8a5a2e" stroke="#3e2410" />
          <ellipse cx="16" cy="10.5" rx="2.4" ry="3.3" fill="#d9b07a" stroke="#3e2410" />
          <ellipse cx="16" cy="10.5" rx="1" ry="1.5" fill="none" stroke="#8a5a2e" />
        </svg>
      );
    case 'gold':
      return (
        <svg {...common}>
          <ellipse cx="8" cy="13" rx="6" ry="3" fill="#b8860b" stroke="#5a3e05" />
          <ellipse cx="8" cy="11.5" rx="6" ry="3" fill="#f2c94c" stroke="#5a3e05" />
          <ellipse cx="13" cy="8" rx="5" ry="2.6" fill="#f7da7a" stroke="#5a3e05" />
        </svg>
      );
    case 'stone':
      return (
        <svg {...common}>
          <path d="M2 15l3-7 5-3 6 2 2 8z" fill="#9c978d" stroke="#3b3833" />
          <path d="M5 8l5-3 1 5-6 5z" fill="#c2bdb2" />
        </svg>
      );
  }
}

export function PopulationIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <circle cx="7" cy="6" r="3" fill="#e8be96" stroke="#5a3a20" />
      <path d="M2 17c0-4 2-6 5-6s5 2 5 6z" fill="#4a7bd1" stroke="#1d3561" />
      <circle cx="14" cy="7" r="2.5" fill="#e8be96" stroke="#5a3a20" />
      <path d="M10 17c0-3 1.5-5 4-5s4 2 4 5z" fill="#6a8fd8" stroke="#1d3561" />
    </svg>
  );
}

export function VillagerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <circle cx="10" cy="5" r="3.5" fill="#e8be96" stroke="#5a3a20" />
      <path d="M4 19c0-6 2.5-9 6-9s6 3 6 9z" fill="#b08a4a" stroke="#4a3420" />
    </svg>
  );
}
