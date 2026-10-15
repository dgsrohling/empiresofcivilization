/** Parâmetros gerais de combate e treinamento. */
export const COMBAT = {
  /** Folga (tiles) somada ao alcance para considerar o alvo ao alcance. */
  rangeSlack: 0.15,
  /** Intervalo (s) entre buscas automáticas de alvo por unidade. */
  scanInterval: 0.5,
  /** Distância máxima (tiles) que uma unidade persegue um alvo encontrado automaticamente, por postura. */
  leash: { aggressive: 14, defensive: 5, holdPosition: 0 },
  /** Intervalo (s) para recalcular a rota de perseguição. */
  chaseRepathInterval: 0.5,
  /** Tempo (s) em que a barra de vida fica visível após sofrer dano. */
  damageDisplayTime: 3,
  /** Itens máximos na fila de treinamento de um edifício. */
  maxQueue: 10,
  /** Reparo: fração do custo do edifício cobrada para restaurar 100% da vida. */
  repairCostFactor: 0.5,
  /** Reparo é este fator mais lento que a construção. */
  repairSlowdown: 3,
} as const;

export type Stance = keyof typeof COMBAT.leash;
