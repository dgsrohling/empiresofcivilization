/** Frequência fixa da simulação (ticks por segundo). */
export const TICK_RATE = 20;
/** Duração de um tick em segundos. */
export const TICK_DT = 1 / TICK_RATE;
/** Duração de um tick em milissegundos. */
export const TICK_MS = 1000 / TICK_RATE;

/** Máximo de unidades aceitas em um único comando (proteção contra abuso). */
export const MAX_COMMAND_UNITS = 200;
