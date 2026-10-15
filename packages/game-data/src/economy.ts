/** Parâmetros gerais da economia. */
export const ECONOMY = {
  /** Distância máxima (tiles) entre o aldeão e a borda do recurso/depósito para interagir. */
  interactionReach: 0.85,
  /** Raio (tiles) de busca automática por outra fonte do mesmo tipo quando a atual se esgota. */
  retargetRadius: 8,
  /** Tentativas de aproximação antes de desistir de um alvo. */
  maxApproachAttempts: 3,
} as const;
