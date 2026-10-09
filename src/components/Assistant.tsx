import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { localAnswer, planBrief, safetyReply, suggestions, SYSTEM_PROMPT, type AskCtx, type ReplyLink } from '../engine';
import { askClaude, ClaudeError, loadKey, saveKey, type ChatTurn } from '../ui/claude';
import type { View } from '../ui/view';
import { Icon } from './Icon';

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  links?: ReplyLink[];
  /** plan: built-in answer. claude: Claude. safety: medical or emergency reply. */
  source?: 'plan' | 'claude' | 'safety';
  note?: string;
  pending?: boolean;
}

let nextId = 1;

/** **bold** inside a line, built as React nodes (never as HTML). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : part));
}

/** Paragraphs and "- " lists from plain text. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>);
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^#{1,6}\s+(.*)$/, '**$1**');
    const item = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (!line) flush();
    else if (item) {
      if (para.length) {
        blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>);
        para = [];
      }
      list.push(item[1]);
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return <>{blocks}</>;
}

const plain = (t: string) => t.replace(/\*\*/g, '').replace(/^[-*•]\s+/gm, '');

/** Reads an answer out loud for anyone who'd rather listen. */
function ReadAloud({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return (
    <button
      className="btn btn-small btn-quiet"
      onClick={() => {
        const s = window.speechSynthesis;
        if (on) {
          s.cancel();
          setOn(false);
          return;
        }
        s.cancel();
        const u = new SpeechSynthesisUtterance(plain(text));
        u.rate = 0.95;
        u.onend = () => setOn(false);
        u.onerror = () => setOn(false);
        s.speak(u);
        setOn(true);
      }}
    >
      <Icon name={on ? 'x' : 'speaker'} size={16} />
      {on ? 'Stop reading' : 'Read aloud'}
    </button>
  );
}

type Recognition = { start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; lang: string; interimResults: boolean };
const SpeechRec = (): (new () => Recognition) | undefined =>
  typeof window === 'undefined' ? undefined : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition);

function ClaudeSettings({ apiKey, setApiKey, open, setOpen }: { apiKey: string; setApiKey: (k: string) => void; open: boolean; setOpen: (o: boolean) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <details className="ask-settings" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>
        <Icon name="lock" size={18} />
        {apiKey ? 'Claude is on. Settings' : 'Want answers to any question? Turn on Claude'}
      </summary>
      <div className="ask-settings-body">
        <p>
          Without a key, every answer comes from the plan on this device and nothing is sent anywhere. With a key, your question and the plan details are sent to Anthropic’s Claude to write the answer. The key is saved only in this browser.
        </p>
        {apiKey ? (
          <div className="ask-key-row">
            <span className="ask-key-on">
              <Icon name="check" size={18} /> Key saved on this device
            </span>
            <button
              className="btn btn-small"
              onClick={() => {
                saveKey('');
                setApiKey('');
              }}
            >
              Remove key
            </button>
          </div>
        ) : (
          <form
            className="ask-key-row"
            onSubmit={(e) => {
              e.preventDefault();
              const k = draft.trim();
              if (!k) return;
              saveKey(k);
              setApiKey(k);
              setDraft('');
              setOpen(false);
            }}
          >
            <label className="sr-only" htmlFor="claude-key">
              Claude API key
            </label>
            <input id="claude-key" className="input" type="password" autoComplete="off" spellCheck={false} placeholder="Paste a Claude API key (sk-ant-...)" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
              Save key
            </button>
          </form>
        )}
        <p className="hint">
          Get a key from the{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Anthropic Console
          </a>
          . Questions are billed to that account. Medical and emergency questions are never sent: they always get the papers’ own words and who to call.
        </p>
      </div>
    </details>
  );
}

export function Assistant({ view, chat, setChat }: { view: View; chat: ChatMsg[]; setChat: Dispatch<SetStateAction<ChatMsg[]>> }) {
  const [draft, setDraft] = useState('');
  const [apiKey, setApiKey] = useState(loadKey);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const busy = chat.some((m) => m.pending);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const rec = useRef<Recognition | null>(null);
  const Rec = SpeechRec();

  const ctx: AskCtx = { plan: view.plan, input: view.input, status: view.status, nowH: view.nowH };

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (chat.length) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [chat.length]);

  const update = (id: number, patch: Partial<ChatMsg>) => setChat((c) => c.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setDraft('');
    const user: ChatMsg = { id: nextId++, role: 'user', text: q };
    const safety = safetyReply(ctx, q);
    const local = localAnswer(ctx, q);
    if (safety || !apiKey) {
      const r = safety ?? local;
      setChat((c) => [...c, user, { id: nextId++, role: 'assistant', text: r.text, links: r.links, source: r.kind === 'safety' ? 'safety' : 'plan' }]);
      return;
    }
    const botId = nextId++;
    const links = local.kind === 'plan' ? local.links : [];
    setChat((c) => [...c, user, { id: botId, role: 'assistant', text: '', source: 'claude', pending: true, links }]);
    // Medical and emergency exchanges never leave the device, not even as history.
    const kept: ChatMsg[] = [];
    for (const m of [...chat, user]) {
      if (m.pending || !m.text) continue;
      if (m.source === 'safety') {
        if (kept[kept.length - 1]?.role === 'user') kept.pop();
        continue;
      }
      kept.push(m);
    }
    const history: ChatTurn[] = kept.map((m) => ({ role: m.role, content: m.text }));
    abort.current = new AbortController();
    try {
      await askClaude({
        key: apiKey,
        system: `${SYSTEM_PROMPT}\n\n<plan>\n${planBrief(ctx, new Date())}\n</plan>`,
        history,
        onText: (text) => update(botId, { text }),
        signal: abort.current.signal,
      });
      update(botId, { pending: false });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const why = e instanceof ClaudeError ? e.message : 'Something went wrong talking to Claude.';
      update(botId, { pending: false, source: 'plan', text: local.text, links: local.links, note: `${why} Here’s what the plan says instead.` });
    }
  }

  function listen() {
    if (!Rec) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Rec();
    r.lang = 'en-US';
    r.interimResults = true;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join('');
      setDraft(text);
    };
    r.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  const ideas = suggestions(ctx);

  return (
    <div className="ask">
      <div className="chat" role="log" aria-live="polite" aria-label="Conversation">
        <div className="msg bot intro">
          <span className="msg-who">First72</span>
          <p>
            Hi! Ask me anything about {view.patientName}’s plan, in your own words. I can tell you what to do next, who’s there when, what it costs, who to call and what help {view.patientName} may get.
          </p>
          <p className="msg-small">I don’t give medical advice. For that, call the number on the discharge papers. In an emergency, call 911.</p>
        </div>

        {!chat.length && (
          <div className="suggest" aria-label="Questions you can ask">
            {ideas.map((s) => (
              <button key={s} className="btn" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {chat.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="msg user">
              <span className="sr-only">You asked: </span>
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={`msg bot${m.source === 'safety' ? ' safety' : ''}`}>
              <span className="msg-who">
                {m.source === 'safety' ? (
                  <>
                    <Icon name="alert" size={14} /> Safety first
                  </>
                ) : m.source === 'claude' ? (
                  'First72 with Claude'
                ) : (
                  'First72, from the plan'
                )}
              </span>
              {m.note && <p className="msg-note">{m.note}</p>}
              {m.text ? <RichText text={m.text} /> : <span className="typing" aria-label="Writing an answer">
                  <i />
                  <i />
                  <i />
                </span>}
              {!m.pending && (
                <div className="msg-actions">
                  {(m.links ?? []).map((l) => (
                    <button key={l.label + l.tab} className="btn btn-small" onClick={() => view.go(l.tab, l.needId)}>
                      {l.label}
                      <Icon name="chevron" size={16} />
                    </button>
                  ))}
                  <ReadAloud text={m.text} />
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      {chat.length > 0 && !busy && (
        <div className="suggest suggest-more">
          {ideas
            .filter((s) => !chat.some((m) => m.role === 'user' && m.text === s))
            .slice(0, 3)
            .map((s) => (
              <button key={s} className="btn btn-small" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          <button
            className="btn btn-small btn-quiet"
            onClick={() => {
              abort.current?.abort();
              setChat([]);
            }}
          >
            Clear the conversation
          </button>
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label className="sr-only" htmlFor="ask-input">
          Your question
        </label>
        <textarea
          id="ask-input"
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={listening ? 'Listening…' : 'Type a question'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        {Rec && (
          <button type="button" className={`btn${listening ? ' listening' : ''}`} onClick={listen} aria-pressed={listening}>
            <Icon name="mic" size={20} />
            <span>{listening ? 'Stop' : 'Speak'}</span>
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() || busy}>
          <Icon name="send" size={20} />
          <span>Ask</span>
        </button>
      </form>

      <ClaudeSettings apiKey={apiKey} setApiKey={setApiKey} open={settingsOpen} setOpen={setSettingsOpen} />
    </div>
  );
}
