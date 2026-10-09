import { fmtRange, type Category, type Need } from '../engine';
import { moneyRange } from '../ui/format';
import type { View } from '../ui/view';
import { Icon } from './Icon';
import { Script } from './Script';
import { StatusControl } from './Status';

export const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'transport', label: 'Transportation' },
  { id: 'meals', label: 'Meals' },
  { id: 'household', label: 'Household help' },
  { id: 'appointments', label: 'Appointment logistics' },
  { id: 'equipment', label: 'Equipment setup' },
  { id: 'relief', label: 'Caregiver relief' },
  { id: 'coordination', label: 'Family coordination' },
  { id: 'providers', label: 'Trusted providers' },
  { id: 'coverage', label: 'Care and coverage' },
];

function Because({ need }: { need: Need }) {
  const papers = need.because.filter((b) => b.kind === 'papers');
  const profile = need.because.filter((b) => b.kind === 'profile');
  return (
    <div className="because">
      {papers.length > 0 && (
        <>
          <span className="src">From the papers: </span>
          {papers.map((b, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <q>{b.kind === 'papers' ? b.quote : ''}</q>
            </span>
          ))}
        </>
      )}
      {profile.length > 0 && (
        <>
          {papers.length > 0 && <br />}
          <span className="src">From your answers: </span>
          {profile.map((b) => (b.kind === 'profile' ? b.fact : '')).join('. ')}
        </>
      )}
    </div>
  );
}

function Task({ need, view, highlight }: { need: Need; view: View; highlight: boolean }) {
  const { plan } = view;
  const a = plan.assignments[need.id];
  const status = view.status[need.id] ?? 'todo';
  const owner = a?.owner ?? { kind: 'none' as const };
  const items = a?.items;
  const service = a?.owner.kind === 'service' ? a.service : undefined;
  const youPay = (items?.youPay.high ?? 0) + (service?.youPay.high ?? 0);
  const covered = [...(items?.layers ?? []), ...(service?.layers ?? []), ...(a?.benefitShare?.funding.layers ?? [])];
  const coveredRange = covered.reduce((r, l) => ({ low: r.low + l.low, high: r.high + l.high }), { low: 0, high: 0 });
  const payRange = { low: (items?.youPay.low ?? 0) + (service?.youPay.low ?? 0), high: youPay };
  const whenLabel = need.beyond ? 'This week' : view.when(a?.at ?? need.window[0]);
  const scriptSource = service?.provider && service.provider.kind !== 'private' ? service.provider.sourceId : items?.layers[0]?.sourceId;

  return (
    <article id={`task-${need.id}`} className={`task${status === 'done' ? ' done' : ''}`} style={highlight ? { background: 'var(--warn-soft)' } : undefined}>
      <div className="task-when num">
        {whenLabel}
        {!need.beyond && need.window[1] - need.window[0] > 3 && <small>by {view.when(need.window[1])}</small>}
        {need.beyond && <small>for later</small>}
      </div>
      <div className="task-main">
        <div className="task-top">
          <h4 className="task-title">{need.title}</h4>
          <StatusControl value={status} onChange={(s) => view.setStatus(need.id, s)} label={`Status of ${need.title}`} />
        </div>
        <div className="task-meta">
          <span
            className={`owner${owner.kind === 'service' ? ' service' : ''}${owner.kind === 'none' ? ' none' : ''}`}
            style={owner.kind === 'crew' ? ({ ['--c' as string]: view.color(owner.memberId) } as React.CSSProperties) : undefined}
          >
            <i />
            {view.ownerLabel(owner)}
          </span>
          {coveredRange.high > 0 && <span className="cost covered num">Covered {moneyRange(coveredRange)}</span>}
          {payRange.high > 0 && (
            <span className="cost num">
              You pay {moneyRange(payRange)}
              {need.costUnit ? ` ${need.costUnit}` : ''}
            </span>
          )}
          {need.beyond && a?.service && a.service.cost.high > 0 && (
            <span className="cost num">
              About {moneyRange(a.service.cost)} {need.costUnit ?? ''} if paid
            </span>
          )}
          {(items?.hsa || service?.hsa) && <span className="cost covered">HSA/FSA eligible</span>}
          {a?.benefitShare && (
            <span className="cost covered">
              Plan meals cover {a.benefitShare.count} of {a.benefitShare.total}
            </span>
          )}
        </div>
        <Because need={need} />
        <details>
          <summary>
            How
            <Icon name="chevron" size={14} />
          </summary>
          <div className="task-detail">
            <p>{need.detail}</p>
            {a?.parts && (
              <ul className="mini-list">
                {a.parts.map((p) => (
                  <li key={p.at}>
                    <span className="num">{view.when(p.at)}</span>
                    <span>{view.ownerLabel(p.owner)}</span>
                  </li>
                ))}
              </ul>
            )}
            {items && (
              <ul className="mini-list">
                {need.items!.map((it) => (
                  <li key={it.name}>
                    <span>{it.name}</span>
                    <span className="num">{moneyRange(it)}</span>
                  </li>
                ))}
                {items.layers.map((l) => (
                  <li key={l.sourceId} style={{ color: 'var(--good)' }}>
                    <span>{l.name}</span>
                    <span className="num">−{moneyRange(l)}</span>
                  </li>
                ))}
              </ul>
            )}
            {owner.kind === 'crew' && a?.backup && !need.beyond && (
              <p>
                If {view.ownerLabel(owner)} can’t: {a.backup.name}.
              </p>
            )}
            {need.beyond && a?.service && (
              <p>
                Options:{' '}
                {a.service.options
                  .filter((o) => o.eligibility !== 'no')
                  .map((o) => `${o.name}${o.kind === 'private' ? '' : o.eligibility === 'maybe' ? ' (check your plan)' : ''}`)
                  .join('; ')}
                .
              </p>
            )}
            {scriptSource && <Script sourceId={scriptSource} ctx={plan.ctx} need={need} at={a?.at ?? need.window[0]} />}
          </div>
        </details>
      </div>
    </article>
  );
}

export function Ledger({ view, highlight, onlyMember }: { view: View; highlight?: string; onlyMember?: string }) {
  const { plan } = view;
  const visible = (n: Need) => {
    if (!onlyMember) return true;
    const o = plan.assignments[n.id]?.owner;
    return o?.kind === 'crew' && o.memberId === onlyMember;
  };
  const presence = plan.needs.find((n) => n.presence);
  const overloaded = plan.loads.filter((l) => l.level !== 'ok' && l.relief);
  const services = plan.needs.filter((n) => plan.assignments[n.id]?.owner.kind === 'service' && !n.beyond && !plan.assignments[n.id]?.parts);

  return (
    <div>
      {CATEGORIES.map((cat) => {
        const list = plan.needs.filter((n) => n.category === cat.id && !n.presence && visible(n));
        const extra =
          cat.id === 'relief' && !onlyMember
            ? (presence ? 1 : 0) + overloaded.length
            : cat.id === 'providers' && !onlyMember
              ? plan.gaps.length + services.length
              : 0;
        const count = list.length + extra;
        return (
          <section className="cat" key={cat.id} aria-labelledby={`cat-${cat.id}`}>
            <div className="cat-head">
              <span className="cat-icon">
                <Icon name={cat.id} />
              </span>
              <h3 id={`cat-${cat.id}`}>{cat.label}</h3>
              <span className="count">{count || 'none'}</span>
            </div>

            {cat.id === 'relief' && !onlyMember && presence && (
              <article className="task">
                <div className="task-when num">
                  All {plan.coverage.required}h
                  <small>{Math.round(plan.coverage.covered)}h covered</small>
                </div>
                <div className="task-main">
                  <h4 className="task-title">{presence.title}</h4>
                  <div className="task-meta">
                    {plan.gaps.length ? (
                      <span className="owner none">
                        <i />
                        {plan.gaps.length} {plan.gaps.length === 1 ? 'gap' : 'gaps'}: {plan.gaps.map((g) => fmtRange(plan.t0, g.start, g.end)).join(', ')}
                      </span>
                    ) : (
                      <span className="cost covered">Every hour has someone</span>
                    )}
                  </div>
                  <Because need={presence} />
                </div>
              </article>
            )}
            {cat.id === 'relief' &&
              !onlyMember &&
              overloaded.map((l) => (
                <article className="task" key={l.memberId}>
                  <div className="task-when num">{l.relief ? view.when(l.relief.start) : ''}</div>
                  <div className="task-main">
                    <div className="task-top">
                      <h4 className="task-title">Give {view.name(l.memberId)} a break</h4>
                      <StatusControl value={view.status[`relief-${l.memberId}`] ?? 'todo'} onChange={(s) => view.setStatus(`relief-${l.memberId}`, s)} label={`Status of a break for ${view.name(l.memberId)}`} />
                    </div>
                    <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>
                      {view.name(l.memberId)} is there {Math.round(l.dutyHours)} of the {plan.coverage.required} hours
                      {l.overnights ? `, including ${l.overnights} ${l.overnights === 1 ? 'night' : 'nights'}` : ''}. Hand off {fmtRange(plan.t0, l.relief!.start, l.relief!.end)}
                      {l.relief!.funding.provider ? ` to ${l.relief!.funding.provider.name.replace(/^Backup care/, 'backup care')}` : ' to a friend, neighbor or church member'}
                      {l.relief!.funding.youPay.high > 0 ? `, about ${moneyRange(l.relief!.funding.youPay)} out of pocket` : ''}.
                    </p>
                  </div>
                </article>
              ))}

            {cat.id === 'providers' &&
              !onlyMember &&
              plan.gaps.map((g) => (
                <article className="task" key={g.id}>
                  <div className="task-when num">{view.when(g.start)}</div>
                  <div className="task-main">
                    <div className="task-top">
                      <h4 className="task-title">Book someone for {fmtRange(plan.t0, g.start, g.end)}</h4>
                      <StatusControl
                        value={view.gapBooked(g.id) ? 'done' : view.status[g.id] ?? 'todo'}
                        onChange={(s) => view.setStatus(g.id, s)}
                        labels={{ todo: 'To do', asked: 'Asked', done: 'Booked' }}
                        label={`Status of the gap ${fmtRange(plan.t0, g.start, g.end)}`}
                      />
                    </div>
                    <div className="task-meta">
                      {g.funding.provider ? (
                        <span className="owner service">
                          <i />
                          {g.funding.provider.name}
                        </span>
                      ) : (
                        <span className="owner none">
                          <i />
                          Nothing can start this fast: ask family or a friend
                        </span>
                      )}
                      {g.funding.layers.length > 0 && <span className="cost covered num">Covered {moneyRange(g.funding.layers.reduce((r, l) => ({ low: r.low + l.low, high: r.high + l.high }), { low: 0, high: 0 }))}</span>}
                      <span className="cost num">You pay {moneyRange(g.funding.youPay)}</span>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                      {g.hours} hours with no one there. <a href="#help">Compare trusted providers</a> that can start in time.
                    </p>
                  </div>
                </article>
              ))}
            {cat.id === 'providers' &&
              !onlyMember &&
              services.map((n) => {
                const a = plan.assignments[n.id];
                return (
                  <article className="task" key={`svc-${n.id}`}>
                    <div className="task-when num">{view.when(a.at)}</div>
                    <div className="task-main">
                      <h4 className="task-title">Book: {n.title.toLowerCase().startsWith('drive') ? n.title.replace(/^Drive/, 'a ride for') : n.title}</h4>
                      <div className="task-meta">
                        <span className="owner service">
                          <i />
                          {view.ownerLabel(a.owner)}
                        </span>
                        {a.service && a.service.youPay.high > 0 && <span className="cost num">You pay {moneyRange(a.service.youPay)}</span>}
                      </div>
                    </div>
                  </article>
                );
              })}

            {list.map((n) => (
              <Task key={n.id} need={n} view={view} highlight={highlight === n.id} />
            ))}
            {count === 0 && <p className="cat-empty">{onlyMember ? 'Nothing for you here.' : cat.id === 'coverage' ? 'Nothing urgent. See Care and coverage below for options.' : 'Nothing in the papers calls for this.'}</p>}
          </section>
        );
      })}
    </div>
  );
}
