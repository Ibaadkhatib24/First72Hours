import { useState } from 'react';
import { sourceById, type Ctx, type Need } from '../engine';
import { Icon } from './Icon';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The word-for-word call script, with what to have ready and the honest caveat. */
export function Script({ sourceId, ctx, need, at }: { sourceId: string; ctx: Ctx; need: Need; at: number }) {
  const s = sourceById(sourceId);
  const [copied, setCopied] = useState(false);
  if (!s) return null;
  const text = s.script(ctx, need, at);
  const contact = s.contact(ctx);
  return (
    <div className="script">
      <div>
        <b>{contact.who}</b>
        {contact.phone && (
          <>
            {' '}
            <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} className="num">
              {contact.phone}
            </a>
          </>
        )}
      </div>
      <blockquote>“{text}”</blockquote>
      <div className="script-actions">
        <button
          className="btn btn-small"
          onClick={async () => {
            setCopied(await copyText(text));
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={16} />
          {copied ? 'Copied' : 'Copy script'}
        </button>
        {contact.phone && (
          <a className="btn btn-small" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>
            <Icon name="phone" size={16} />
            Call
          </a>
        )}
      </div>
      {s.bring.length > 0 && (
        <div>
          Have ready:
          <ul>
            {s.bring.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="caveat">{s.caveat}</p>
    </div>
  );
}
