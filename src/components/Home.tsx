import { fmtRange, mid } from '../engine';
import { about, keepTimes } from '../ui/format';
import type { View } from '../ui/view';
import { FlagRow } from './HeadsUpList';
import { Icon } from './Icon';
import { TABS, badgeFor } from './Tabs';

function NextUp({ view }: { view: View }) {
  const { plan, status } = view;
  const next = plan.needs
    .filter((n) => !n.presence && !n.beyond && status[n.id] !== 'done' && plan.assignments[n.id])
    .sort((a, b) => plan.assignments[a.id].at - plan.assignments[b.id].at)
    .slice(0, 3);
  if (!next.length) return <p className="empty">Everything on the list is done.</p>;
  return (
    <ul className="next-list">
      {next.map((n) => {
        const a = plan.assignments[n.id];
        return (
          <li key={n.id}>
            <span className="next-when num">{view.when(a.at)}</span>
            <span className="next-main">
              <b>{n.title}</b>
              <span>{view.ownerLabel(a.owner)}</span>
            </span>
            <button className="btn" onClick={() => view.setStatus(n.id, 'done')}>
              <Icon name="check" size={18} />
              Done
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Home({ view, demo, onEdit }: { view: View; demo: boolean; onEdit: (step: number) => void }) {
  const { plan, heads, status } = view;
  const t = plan.totals;
  const uninsured = plan.screening.uninsured;
  const likely = plan.screening.programs.filter((p) => p.status === 'likely' && ['hospital-fa', 'fqhc', 'medicaid', 'marketplace', 'snap'].includes(p.id)).length;
  const openGaps = plan.gaps.filter((g) => !view.gapBooked(g.id));
  const top = heads.flags.filter((f) => !f.resolved).slice(0, 3);
  const tasks = plan.needs.filter((n) => !n.presence);
  const left = tasks.filter((n) => status[n.id] !== 'done').length;

  const tileStatus: Record<string, string> = {
    alerts: heads.open ? `${heads.open} to look at` : 'Nothing open',
    schedule: openGaps.length ? `${openGaps.length} ${openGaps.length === 1 ? 'time' : 'times'} with nobody there` : 'Every hour covered',
    todo: `${left} of ${tasks.length} left`,
    money: `About ${about(t.youPay)} for the family`,
    coverage: likely ? `${likely} ${likely === 1 ? 'program' : 'programs'} likely` : 'See what applies',
    helpers: `${view.input.crew.length} ${view.input.crew.length === 1 ? 'person' : 'people'}`,
    hire: 'Checked, priced, can start in time',
    later: `${plan.needs.filter((n) => n.beyond).length + plan.calls.filter((c) => c.status === 'later').length} things to start`,
  };

  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-title">
        <h1 id="home-title">
          {view.patientName} comes home <span className="nowrap">{view.when(0)}</span>
          {uninsured ? ' without insurance' : ''}.
        </h1>
        <ul className="facts">
          <li>
            <Icon name="clock" size={22} />
            <span>
              {plan.coverage.required > 0 ? (
                <>
                  {Math.round(plan.coverage.covered)} of {plan.coverage.required} hours have someone there.{' '}
                  {openGaps.length > 0 && (
                    <b className="bad">
                      Nobody yet: {openGaps.map((g) => keepTimes(fmtRange(plan.t0, g.start, g.end))).join(', ')}.
                    </b>
                  )}
                </>
              ) : (
                'The papers don’t ask for someone there around the clock.'
              )}
            </span>
          </li>
          <li>
            <Icon name="money" size={22} />
            <span>
              About <b>{about(t.youPay)}</b> for the family over 72 hours
              {mid(t.benefits) >= 10 ? (
                <>
                  , after <b className="good">{about(t.benefits)}</b> of {uninsured ? 'free help' : 'benefits'}
                </>
              ) : null}
              .
            </span>
          </li>
          {likely > 0 && (
            <li>
              <Icon name="coverage" size={22} />
              <span>
                {view.patientName} likely qualifies for{' '}
                <a href="#coverage" className="good">
                  {likely} {likely === 1 ? 'program' : 'programs'}
                </a>
                , like the hospital’s financial assistance.
              </span>
            </li>
          )}
        </ul>
      </section>

      <section className="home-block" aria-labelledby="hu-title">
        <div className="block-head">
          <h2 id="hu-title">Heads up</h2>
          {heads.open > top.length && <a href="#alerts">See all {heads.open}</a>}
        </div>
        {top.length ? (
          <ul className="flag-list">
            {top.map((f) => (
              <FlagRow key={f.id} flag={f} view={view} />
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing needs attention right now.</p>
        )}
      </section>

      <section className="home-block" aria-labelledby="next-title">
        <div className="block-head">
          <h2 id="next-title">Next up</h2>
          <a href="#todo">Full to-do list</a>
        </div>
        <NextUp view={view} />
      </section>

      <section className="home-block" aria-labelledby="all-title">
        <h2 id="all-title">Everything in the plan</h2>
        <div className="tiles">
          {TABS.filter((x) => x.id !== 'home').map((x) => {
            const badge = badgeFor(view, x.id);
            return (
              <a key={x.id} href={`#${x.id}`} className={`tile${badge?.urgent ? ' urgent' : ''}`}>
                <span className="tile-icon">
                  <Icon name={x.icon} size={26} />
                </span>
                <span className="tile-text">
                  <b>{x.label}</b>
                  <span>{tileStatus[x.id]}</span>
                </span>
                <Icon name="chevron" size={20} className="tile-go" />
              </a>
            );
          })}
        </div>
      </section>

      {demo && (
        <p className="demo-note">
          This is a sample family.{' '}
          <button className="link" onClick={() => onEdit(1)}>
            Change the papers
          </button>{' '}
          or{' '}
          <button className="link" onClick={() => onEdit(2)}>
            the helpers
          </button>{' '}
          and the plan rebuilds itself.
        </p>
      )}
    </div>
  );
}

export function ScheduleList({ view }: { view: View }) {
  const { plan } = view;
  const rows: Array<{ start: number; end: number; who: string | null; gapId?: string }> = [];
  for (const s of plan.shifts) {
    const last = rows[rows.length - 1];
    if (last && last.who === s.memberId && Math.abs(last.end - s.start) < 1e-9) last.end = s.end;
    else rows.push({ start: s.start, end: s.end, who: s.memberId });
  }
  if (!rows.length) return <p className="empty">The papers don’t ask for someone there around the clock, so there are no shifts. Check-ins are on the to-do list.</p>;
  return (
    <section className="home-block" aria-labelledby="who-title">
      <h2 id="who-title">Who’s there, in order</h2>
      <ul className="shift-list">
        {rows.map((r) => {
          const gap = r.who ? undefined : plan.gaps.find((g) => g.start <= r.start + 1e-9 && g.end >= r.end - 1e-9);
          const booked = gap ? view.gapBooked(gap.id) : false;
          return (
            <li key={r.start} className={r.who ? '' : booked ? 'booked' : 'nobody'}>
              <span className="num shift-when">{fmtRange(plan.t0, r.start, r.end)}</span>
              {r.who ? (
                <span className="shift-who">
                  <i style={{ background: view.color(r.who) }} />
                  {view.name(r.who)}
                </span>
              ) : (
                <span className="shift-who">
                  {booked ? (
                    <b>Booked: {gap?.funding.provider?.name ?? 'paid help'}</b>
                  ) : (
                    <>
                      <b className="bad">Nobody yet</b>
                      <a className="btn btn-small" href="#hire">
                        Find help
                      </a>
                      {gap && (
                        <button className="btn btn-small btn-quiet" onClick={() => view.setStatus(gap.id, 'done')}>
                          Mark as covered
                        </button>
                      )}
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
