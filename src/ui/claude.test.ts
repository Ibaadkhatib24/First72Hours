import { afterEach, describe, expect, it, vi } from 'vitest';
import { askClaude, toTurns } from './claude';

afterEach(() => vi.unstubAllGlobals());

function sse(events: object[]): Response {
  const body = events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(body);
  // Split mid-line to make sure partial chunks are handled.
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, 37));
      c.enqueue(bytes.slice(37));
      c.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe('toTurns', () => {
  it('starts with the person and merges back-to-back turns', () => {
    expect(
      toTurns([
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'a' },
        { role: 'user', content: 'b' },
        { role: 'assistant', content: 'c' },
      ]),
    ).toEqual([
      { role: 'user', content: 'a\n\nb' },
      { role: 'assistant', content: 'c' },
    ]);
  });
});

describe('askClaude', () => {
  it('streams text and sends the browser header and key', async () => {
    const fetchMock = vi.fn(async () =>
      sse([
        { type: 'message_start' },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Call ' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Marcus.' } },
        { type: 'message_stop' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const seen: string[] = [];
    const out = await askClaude({ key: 'sk-test', system: 'sys', history: [{ role: 'user', content: 'Who?' }], onText: (t) => seen.push(t) });
    expect(out).toBe('Call Marcus.');
    expect(seen).toEqual(['Call ', 'Call Marcus.']);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(JSON.parse(String(init.body))).toMatchObject({ system: 'sys', stream: true, messages: [{ role: 'user', content: 'Who?' }] });
  });

  it('turns a bad key into plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 })));
    await expect(askClaude({ key: 'bad', system: '', history: [{ role: 'user', content: 'hi' }], onText: () => {} })).rejects.toThrow(/key didn’t work/);
  });

  it('says when the internet is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(askClaude({ key: 'k', system: '', history: [{ role: 'user', content: 'hi' }], onText: () => {} })).rejects.toThrow(/internet/);
  });
});
