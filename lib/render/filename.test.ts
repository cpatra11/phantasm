import { describe, expect, it } from 'vitest';
import { renderFilename } from './filename';

describe('renderFilename', () => {
  it('builds a safe download name from the title', () => {
    expect(renderFilename('Daily ads for Instagram: one design', '9:16', 'video')).toBe('daily-ads-for-instagram-one-design-9x16.mp4');
    expect(renderFilename('Daily ads', '16:9', 'still')).toBe('daily-ads-16x9.png');
  });

  it('falls back when the title has no safe characters', () => {
    expect(renderFilename('!!!', '9:16', 'still')).toBe('phantasma-9x16.png');
  });
});
