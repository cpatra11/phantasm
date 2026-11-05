import { describe, expect, it } from 'vitest';
import { briefWithParams, clampDurationMs, EFFORT_STEP_BUDGET } from './params';

describe('composer params', () => {
  it('clamps durations to Hera bounds (3s floor, 120s ceiling)', () => {
    expect(clampDurationMs(100)).toBe(3000);
    expect(clampDurationMs(6500)).toBe(6500);
    expect(clampDurationMs(999_000)).toBe(120_000);
  });

  it('effort budgets increase with effort', () => {
    expect(EFFORT_STEP_BUDGET.low).toBeLessThan(EFFORT_STEP_BUDGET.medium);
    expect(EFFORT_STEP_BUDGET.medium).toBeLessThan(EFFORT_STEP_BUDGET.high);
  });

  it('appends format and variety notes only when set', () => {
    expect(briefWithParams('Launch ad', {})).toBe('Launch ad');
    expect(briefWithParams('Launch ad', { aspect: 'auto', variety: 'wide' })).toContain('different takes');
    expect(briefWithParams('Launch ad', { aspect: '9:16' })).toContain('Format: 9:16.');
  });
});
