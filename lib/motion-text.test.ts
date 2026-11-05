import { describe, expect, it } from 'vitest';
import { countText, typeText } from './motion-text';

describe('typeText', () => {
  it('reveals characters with progress', () => {
    expect(typeText('Hello world', 0)).toBe('');
    expect(typeText('Hello world', 0.5)).toBe('Hello');
    expect(typeText('Hello world', 1)).toBe('Hello world');
  });
});

describe('countText', () => {
  it('counts the first number, keeping suffix and decimals', () => {
    expect(countText('92%', 0)).toBe('0%');
    expect(countText('92%', 1)).toBe('92%');
    expect(countText('$1.5k saved', 1)).toBe('$1.5k saved');
    expect(countText('No numbers', 0.5)).toBe('No numbers');
  });

  it('is monotonic and eased', () => {
    const mid = Number(countText('100', 0.5).match(/\d+/)![0]);
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(100);
  });
});
