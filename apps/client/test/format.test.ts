import { describe, expect, it } from 'vitest';
import { formatTime } from '../src/hud/format';

describe('formatTime', () => {
  it('formata minutos e horas', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(75.9)).toBe('01:15');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});
