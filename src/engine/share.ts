import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { CaseInput } from './types';

// The whole plan lives in the link's #fragment. Browsers never send the fragment to a
// server, so health details stay between the people who have the link.

export type Status = 'todo' | 'asked' | 'done';

export interface SharedState {
  v: 1;
  input: CaseInput;
  status: Record<string, Status>;
}

export function encodeState(state: SharedState): string {
  return compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeState(encoded: string): SharedState | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json) as SharedState;
    if (parsed?.v !== 1 || !parsed.input?.patient || !Array.isArray(parsed.input.crew)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function shareUrl(base: string, state: SharedState, me?: string): string {
  const url = base.split('#')[0];
  return `${url}#plan=${encodeState(state)}${me ? `&me=${encodeURIComponent(me)}` : ''}`;
}

export function readHash(hash: string): { state: SharedState | null; me?: string } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const plan = params.get('plan');
  return { state: plan ? decodeState(plan) : null, me: params.get('me') ?? undefined };
}
