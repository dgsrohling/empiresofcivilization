import type { ResourceAmounts, ResourceType } from '@eoc/shared';

interface Entry {
  time: number;
  resource: ResourceType;
  amount: number;
}

/** Calcula o ritmo de coleta (por minuto) a partir dos depósitos numa janela móvel de tempo de jogo. */
export class DepositRateTracker {
  private entries: Entry[] = [];

  constructor(private readonly windowSeconds = 60) {}

  record(time: number, resource: ResourceType, amount: number): void {
    this.entries.push({ time, resource, amount });
  }

  ratePerMinute(now: number): ResourceAmounts {
    const from = now - this.windowSeconds;
    if (this.entries.length > 0 && this.entries[0]!.time < from) this.entries = this.entries.filter((e) => e.time >= from);
    const totals: ResourceAmounts = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const e of this.entries) totals[e.resource] += e.amount;
    // No início da partida a janela ainda não está cheia: normaliza pelo tempo decorrido.
    const span = Math.min(this.windowSeconds, Math.max(now, 1));
    for (const key of Object.keys(totals) as ResourceType[]) totals[key] = Math.round((totals[key] * 60) / span);
    return totals;
  }
}
