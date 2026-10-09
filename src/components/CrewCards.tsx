import { fmtRange, shareUrl, type CaseInput, type Status } from '../engine';
import { memberMessage, memberPlan, smsHref } from '../ui/messages';
import type { View } from '../ui/view';
import { Icon } from './Icon';
import { copyText } from './Script';

const DIST = { home: 'Lives there', near: 'Nearby', far: 'Remote' };

export function CrewCards({ view, input, status, onToast }: { view: View; input: CaseInput; status: Record<string, Status>; onToast: (t: string) => void }) {
  const { plan } = view;
  return (
    <div className="crew-grid">
      {input.crew.map((m) => {
        const load = plan.loads.find((l) => l.memberId === m.id)!;
        const mp = memberPlan(view, m.id);
        const c = view.color(m.id);
        const link = shareUrl(location.href, { v: 1, input, status }, m.id);
        const msg = memberMessage(view, m.id, link);
        const share = plan.coverage.required ? load.dutyHours / plan.coverage.required : 0;
        return (
          <article className="helper" key={m.id} style={{ ['--c' as string]: c } as React.CSSProperties}>
            <div className="band">
              <b>{m.name || 'Helper'}</b>
              <span>
                {m.relation ? `${m.relation}, ` : ''}
                {DIST[m.distance].toLowerCase()}
              </span>
            </div>
            <div className="helper-body">
              {m.distance !== 'far' && plan.coverage.required > 0 && (
                <div className="load">
                  <div className="load-bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </div>
                  <span className="load-text num">
                    With {view.patientName} {Math.round(load.dutyHours)} of {plan.coverage.required} hours
                    {load.overnights ? `, ${load.overnights} ${load.overnights === 1 ? 'night' : 'nights'}` : ''}. Tasks: about {Math.round(load.taskHours * 2) / 2}h.
                  </span>
                </div>
              )}
              {m.distance === 'far' && (
                <p className="load-text">
                  Owns the phone calls, orders and payments, so the people nearby can stay with {view.patientName}.
                </p>
              )}
              {load.level !== 'ok' && (
                <div className={`flag${load.level === 'heavy' ? ' heavy' : ''}`}>
                  <Icon name="alert" size={18} />
                  <span>
                    {load.level === 'overloaded' ? `${m.name} is carrying too much.` : `${m.name} has a heavy stretch.`}
                    {load.relief && ` Hand off ${fmtRange(plan.t0, load.relief.start, load.relief.end)}${load.relief.funding.provider ? ` to ${load.relief.funding.provider.name.replace(/^Backup care/, 'backup care')}` : ''}.`}
                  </span>
                </div>
              )}
              {mp.tasks.length > 0 ? (
                <ol>
                  {mp.tasks.map((t) => (
                    <li key={t.needId}>
                      <time className="num">{view.when(t.at)}</time>
                      <a href={`#task-${t.needId}`} style={{ textDecoration: 'none' }}>
                        {status[t.needId] === 'done' ? <s>{t.title}</s> : t.title}
                      </a>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="load-text">{mp.shifts.length ? `No separate tasks. Being there is the help.` : 'No tasks yet.'}</p>
              )}
              {mp.meals > 0 && <p className="load-text">Plus {mp.meals} {mp.meals === 1 ? 'meal' : 'meals'} while there.</p>}
              {load.level === 'overloaded' && m.distance !== 'far' && (
                <p className="fmla">
                  If {m.name}’s employer has 50 or more employees, the FMLA may protect up to 12 weeks of unpaid leave to care for a parent or spouse. Ask HR.
                </p>
              )}
            </div>
            <div className="helper-actions">
              <a className="btn btn-small" href={smsHref(msg, m.phone)}>
                <Icon name="message" size={16} />
                Text {m.name || 'them'} their list
              </a>
              <button
                className="btn btn-small btn-quiet"
                onClick={async () => onToast((await copyText(msg)) ? `Copied ${m.name}’s list` : 'Copy didn’t work in this browser')}
              >
                <Icon name="copy" size={16} />
                Copy
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
