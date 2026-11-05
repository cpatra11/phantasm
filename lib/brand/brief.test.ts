import { describe, expect, it } from 'vitest';
import { CreativeBriefSchema, fallbackBrief } from './brief';
import { brandBlock } from '../meta/prompts';
import type { BrandKit } from './types';

const brand: BrandKit = {
  sourceUrl: 'https://whisprflow.com',
  name: 'Wispr Flow',
  tagline: 'Effortless voice dictation that turns speech into polished writing.',
  colors: { primary: '#111111', secondary: '#6C5CE7', background: '#FFFFFF', text: '#111111' },
  fonts: { heading: 'Eb Garamond', body: 'Figtree' },
  source: 'firecrawl',
  voice: ['Speak. Write. Done.', '4x faster than typing'],
  images: [{ url: 'https://cdn.example/app.png', label: 'Flow app with mic button', kind: 'screenshot' }],
  about: 'Wispr Flow is voice dictation software: you speak naturally and it writes clean, formatted text wherever you type.',
  creative: {
    whatItIs: 'Wispr Flow is voice dictation software: you speak naturally and it writes clean, formatted text wherever you type.',
    audience: 'writers and professionals who think faster than they type',
    benefits: ['4x faster than typing', 'works in every app'],
    moments: ['commuter dictating an email hands-free', 'messy spoken thought becoming a clean paragraph'],
    visualElements: ['microphone button', 'sound waveform while speaking', 'spoken words becoming formatted paragraphs', 'cursor in a document'],
    settings: ['morning desk with coffee', 'walking outdoors with earbuds'],
    uiElements: ['mic button', 'waveform bars', 'document with formatted text'],
    tone: 'calm, magical, precise',
    avoid: ['generic microphone stock photos', 'typing on a keyboard as the hero moment'],
  },
};

describe('product brief', () => {
  it('fallback brief is valid and grounded in site material', () => {
    const b = fallbackBrief(brand);
    expect(() => CreativeBriefSchema.parse(b)).not.toThrow();
    expect(b.whatItIs).toContain('Wispr Flow');
    expect(b.whatItIs).toContain('voice dictation');
  });

  it('brandBlock carries the understanding into every generator prompt', () => {
    const block = brandBlock(brand);
    expect(block).toContain('Product understanding');
    expect(block).toContain('sound waveform while speaking');
    expect(block).toContain('mic button');
    expect(block).toContain('Avoid: generic microphone stock photos');
  });
});
