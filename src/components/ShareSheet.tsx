import { useEffect, useRef, useState } from 'react';
import { shareUrl, type CaseInput, type Status } from '../engine';
import { memberMessage, smsHref } from '../ui/messages';
import type { View } from '../ui/view';
import { Icon } from './Icon';
import { copyText } from './Script';

export function ShareSheet({ view, input, status, onClose }: { view: View; input: CaseInput; status: Record<string, Status>; onClose: () => void }) {
  const link = shareUrl(location.href, { v: 1, input, status });
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2 id="share-title">Share the plan</h2>
            <p>The whole plan is packed into the link itself. There’s no account and no server, so only people with the link can see it.</p>
          </div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <button
          className="btn btn-primary"
          onClick={async () => {
            setCopied(await copyText(link));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={18} />
          {copied ? 'Link copied' : 'Copy the link to the full plan'}
        </button>
        <p>Or send each person just their part:</p>
        <ul className="sheet-people">
          {input.crew.map((m) => (
            <li key={m.id}>
              <b>
                <i style={{ ['--c' as string]: view.color(m.id) } as React.CSSProperties} />
                {m.name || 'Helper'}
              </b>
              <a className="btn btn-small" href={smsHref(memberMessage(view, m.id, shareUrl(location.href, { v: 1, input, status }, m.id)), m.phone)}>
                <Icon name="message" size={16} />
                Text
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Asks before wiping a real plan, since it only lives on this device and in shared links. */
export function NewPlanSheet({ name, onStart, onShare, onClose }: { name: string; onStart: () => void; onShare: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="new-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <h2 id="new-title">Start a new plan?</h2>
            <p>This clears {name}’s plan from this device. If you want to keep it, share the link first. Anyone with the link can still open it.</p>
          </div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-actions">
          <button className="btn btn-primary" onClick={onStart}>
            <Icon name="plus" size={18} />
            Start a new plan
          </button>
          <button className="btn" onClick={onShare}>
            <Icon name="share" size={18} />
            Save {name}’s link first
          </button>
          <button className="btn btn-quiet" onClick={onClose}>
            Keep this plan
          </button>
        </div>
      </div>
    </div>
  );
}
