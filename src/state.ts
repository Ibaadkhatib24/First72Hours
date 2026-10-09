import { useEffect, useState } from 'react';
import type { CaseInput, Status } from './engine';
import { readHash } from './engine';

export type Screen = 'start' | 'intake' | 'plan';

export interface AppState {
  screen: Screen;
  step: number;
  input: CaseInput | null;
  status: Record<string, Status>;
  /** Viewing a shared link as one helper. */
  me?: string;
  demo?: boolean;
}

const KEY = 'first72:v1';

export function loadInitial(): AppState {
  const fromLink = readHash(typeof location !== 'undefined' ? location.hash : '');
  if (fromLink.state) {
    return { screen: 'plan', step: 0, input: fromLink.state.input, status: fromLink.state.status ?? {}, me: fromLink.me };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as AppState;
      if (saved && saved.screen) return { ...saved, me: undefined };
    }
  } catch {
    // Storage can be unavailable (private mode, blocked). The app works without it.
  }
  return { screen: 'start', step: 0, input: null, status: {} };
}

export function persist(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, me: undefined }));
  } catch {
    // Ignore: saving is a convenience.
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}

/** Current time, refreshed every 30 seconds. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
