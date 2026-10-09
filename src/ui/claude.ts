import { CLAUDE_MODEL } from '../engine';

/**
 * Talks to Claude straight from the browser with the caregiver's own key.
 * There is still no First72 server: the request goes from this device to Anthropic.
 */

const KEY = 'first72:claude-key';

export function loadKey(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY, key);
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the key lasts until the page closes, which is fine.
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export class ClaudeError extends Error {}

function friendly(status: number, detail?: string): string {
  if (status === 401) return 'That key didn’t work. Check it in the Claude settings below.';
  if (status === 403) return 'That key isn’t allowed to use Claude. Check the account in the Anthropic Console.';
  if (status === 429) return 'Claude is getting too many questions right now. Try again in a minute.';
  if (status === 529 || status >= 500) return 'Claude is busy right now. Try again in a minute.';
  if (status === 400 && detail && /credit|balance|billing/i.test(detail)) return 'The Claude account is out of credits.';
  return detail ? `Claude said: ${detail}` : 'Something went wrong talking to Claude.';
}

/** Claude needs turns that alternate, starting with the person. */
export function toTurns(history: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of history) {
    if (!t.content.trim()) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n\n${t.content}`;
    else out.push({ ...t });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out.slice(-12);
}

/** Streams Claude's answer. `onText` gets the whole answer so far each time more arrives. */
export async function askClaude(opts: { key: string; system: string; history: ChatTurn[]; onText: (full: string) => void; signal?: AbortSignal }): Promise<string> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 700, system: opts.system, messages: toTurns(opts.history), stream: true }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ClaudeError('Couldn’t reach Claude. Check the internet connection.');
  }
  if (!res.ok || !res.body) {
    let detail: string | undefined;
    try {
      detail = (await res.json())?.error?.message;
    } catch {
      // Keep the status-based message.
    }
    throw new ClaudeError(friendly(res.status, detail));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      let ev: { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
      try {
        ev = JSON.parse(line.slice(5));
      } catch {
        continue;
      }
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
        full += ev.delta.text;
        opts.onText(full);
      } else if (ev.type === 'error') {
        throw new ClaudeError(friendly(0, ev.error?.message));
      }
    }
  }
  if (!full.trim()) throw new ClaudeError('Claude didn’t send an answer. Try asking again.');
  return full;
}
