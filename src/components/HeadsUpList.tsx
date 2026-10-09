import type { Flag } from '../engine';
import type { View } from '../ui/view';
import { keepTimes } from '../ui/format';
import { Icon } from './Icon';

const LEVEL = { now: 'Needs attention now', soon: 'Do soon', watch: 'Keep an eye on' } as const;

export function FlagRow({ flag, view }: { flag: Flag; view: View }) {
  return (
    <li className={`flag-row ${flag.resolved ? 'handled' : flag.level}`}>
      <div className="flag-body">
        <span className={`level ${flag.resolved ? 'handled' : flag.level}`}>
          <Icon name={flag.resolved ? 'check' : flag.level === 'watch' ? 'clock' : 'alert'} size={16} />
          {flag.resolved ? 'Handled' : LEVEL[flag.level]}
        </span>
        <h3>{keepTimes(flag.title)}</h3>
        {!flag.resolved && (
          <>
            <p className="flag-why">{flag.why}</p>
            {flag.quote && (
              <p className="because">
                <span className="src">From the papers: </span>
                <q>{flag.quote}</q>
              </p>
            )}
            <p className="flag-do">
              <b>What to do:</b> {flag.action}
            </p>
          </>
        )}
      </div>
      <button className={`btn${flag.resolved ? '' : ' btn-primary'}`} onClick={() => view.go(flag.tab, flag.needIds.find((id) => view.status[id] !== 'done') ?? flag.needIds[0])}>
        {flag.resolved ? 'See it' : 'Fix it'}
      </button>
    </li>
  );
}

export function WarningSigns({ view }: { view: View }) {
  const { warnings } = view.heads;
  return (
    <section className="warn-box" aria-labelledby="warn-title">
      <h2 id="warn-title">
        <Icon name="alert" size={22} />
        Get medical help if you see these
      </h2>
      {warnings.length > 0 ? (
        <ul>
          {warnings.map((w) => (
            <li key={w}>
              <q>{w}</q>
            </li>
          ))}
        </ul>
      ) : (
        <p>The papers you entered don’t list warning signs. Ask the hospital which signs mean you should call.</p>
      )}
      <p className="warn-calls">
        <b>Emergency: call 911.</b> Medical questions: call the number on the discharge papers.
      </p>
      <p className="warn-note">These lines are copied from {view.patientName}’s discharge papers. First72 doesn’t give medical advice.</p>
    </section>
  );
}

export function HeadsUpPage({ view }: { view: View }) {
  const { flags } = view.heads;
  const groups: Array<{ key: string; label: string; items: Flag[] }> = [
    { key: 'now', label: 'Needs attention now', items: flags.filter((f) => !f.resolved && f.level === 'now') },
    { key: 'soon', label: 'Do soon', items: flags.filter((f) => !f.resolved && f.level === 'soon') },
    { key: 'watch', label: 'Keep an eye on', items: flags.filter((f) => !f.resolved && f.level === 'watch') },
    { key: 'handled', label: 'Handled', items: flags.filter((f) => f.resolved) },
  ];
  return (
    <>
      <WarningSigns view={view} />
      <p className="stat">
        Nearly 1 in 4 people have a problem after leaving the hospital, and about half of those can be prevented or made less serious.{' '}
        <a href="https://www.cmaj.ca/content/170/3/353" target="_blank" rel="noreferrer">
          Source
        </a>
      </p>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.key} className="flag-group" aria-label={g.label}>
            <h2>
              {g.label} <span className="count">{g.items.length}</span>
            </h2>
            <ul className="flag-list">
              {g.items.map((f) => (
                <FlagRow key={f.id} flag={f} view={view} />
              ))}
            </ul>
          </section>
        ))}
    </>
  );
}
