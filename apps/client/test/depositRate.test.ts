import { describe, expect, it } from 'vitest';
import { DepositRateTracker } from '../src/game/DepositRateTracker';

describe('DepositRateTracker', () => {
  it('normaliza pelo tempo decorrido no início da partida', () => {
    const t = new DepositRateTracker(60);
    t.record(10, 'wood', 10);
    t.record(20, 'wood', 10);
    expect(t.ratePerMinute(30).wood).toBe(40);
  });

  it('descarta depósitos fora da janela', () => {
    const t = new DepositRateTracker(60);
    t.record(5, 'gold', 10);
    t.record(100, 'gold', 10);
    const r = t.ratePerMinute(120);
    expect(r.gold).toBe(10);
    expect(r.food).toBe(0);
  });
});
