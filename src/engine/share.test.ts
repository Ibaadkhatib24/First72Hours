import { describe, expect, it } from 'vitest';
import { sampleCase } from './sample';
import { decodeState, encodeState, readHash, shareUrl } from './share';

describe('share links', () => {
  const state = { v: 1 as const, input: sampleCase(new Date(2026, 9, 13, 9)), status: { kit: 'done' as const } };

  it('round-trips the whole plan through the link', () => {
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('puts the plan in the #fragment, which browsers never send to a server', () => {
    const url = shareUrl('https://example.org/app/?x=1#old', state, 'dev');
    expect(url.startsWith('https://example.org/app/?x=1#plan=')).toBe(true);
    const { state: back, me } = readHash(new URL(url).hash);
    expect(back).toEqual(state);
    expect(me).toBe('dev');
  });

  it('keeps the link short enough to text', () => {
    expect(encodeState(state).length).toBeLessThan(3000);
  });

  it('rejects garbage', () => {
    expect(decodeState('not-a-plan')).toBeNull();
  });
});
