import { useEffect, useMemo, useState } from 'react';
import { dayName, fmtRange, PARTS, sourceById, type CaseInput, type Plan, type Status } from '../engine';
import { useNow } from '../state';
import { about, moneyRange, plural } from '../ui/format';
import { makeView, type View } from '../ui/view';
import { CareCoverage } from './CareCoverage';
import { CrewCards } from './CrewCards';
import { Fridge } from './Fridge';
import { Icon } from './Icon';
import { Ledger } from './Ledger';
import { Providers } from './Providers';
import { Runway } from './Runway';
import { ShareSheet } from './ShareSheet';
import { BrandMark } from './Start';
import { WhoPays } from './WhoPays';

interface Props {
  plan: Plan;
  input: CaseInput;
  status: Record<string, Status>;
  me?: string;
  demo: boolean;
  onStatus: (id: string, s: Status) => void;
  onInput: (input: CaseInput) => void;
  onEdit: (step?: number) => void;
  onClearMe: () => void;
  onReset: () => void;
}

function clockText(nowH: number) {
  if (nowH < 0) {
    const h = Math.floor(-nowH);
    const m = Math.round((-nowH - h) * 60);
    return `Discharge in ${h ? `${h}h ` : ''}${m}m`;
  }
  if (nowH <= 72) return `Hour ${Math.floor(nowH)} of 72`;
  return 'First 72 hours done';
}

function gapPhrase(view: View) {
  const { plan } = view;
  return plan.gaps
    .map((g) => {
      const b = plan.blocks.find((x) => Math.abs(x.start - g.start) < 1e-9 && Math.abs(x.end - g.end) < 1e-9);
      return b ? `${dayName(plan.t0, b.d, true)} ${PARTS[b.p].label.toLowerCase()}` : fmtRange(plan.t0, g.start, g.end);
    })
    .reduce((acc, s, i, arr) => (i === 0 ? s : i === arr.length - 1 ? `${acc} and ${s}` : `${acc}, ${s}`), '');
}

export function PlanView({ plan, input, status, me, demo, onStatus, onInput, onEdit, onClearMe, onReset }: Props) {
  const now = useNow();
  const view = useMemo(() => makeView(plan, input, status, onStatus, now), [plan, input, status, onStatus, now]);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | undefined>();
  const [onlyMine, setOnlyMine] = useState(!!me);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const pick = (needId: string) => {
    setOnlyMine(false);
    setHighlight(needId);
    requestAnimationFrame(() => document.getElementById(`task-${needId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    setTimeout(() => setHighlight(undefined), 2600);
  };

  const t = plan.totals;
  const chip = input.crew.filter((m) => m.chipIn).length;
  const heavy = plan.loads.filter((l) => l.level === 'overloaded');
  const meName = me ? view.name(me) : undefined;
  const later = plan.calls.filter((c) => c.status === 'later');
  const uninsured = plan.screening.uninsured;
  const SHORT: Record<string, string> = {
    'hospital-fa': 'the hospital’s financial assistance',
    fqhc: 'a sliding-fee health center',
    medicaid: 'Medicaid',
    marketplace: 'a Marketplace plan with tax credits',
    snap: 'food assistance',
  };
  const likely = plan.screening.programs.filter((p) => p.status === 'likely' && SHORT[p.id]).map((p) => SHORT[p.id]);
  const coverage = (
    <section className="section" id="coverage" aria-labelledby="coverage-title">
      <div className="section-head">
        <h2 id="coverage-title">Care and coverage</h2>
        <p>What {view.patientName} could qualify for, worked out from the intake answers. Follow-up care, the hospital bill, food and prescriptions.</p>
      </div>
      <CareCoverage view={view} input={input} onInput={onInput} />
    </section>
  );
  const beyond = plan.needs.filter((n) => n.beyond);

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="shell topbar-inner">
            <span className="brand">
              <BrandMark />
              <span className="brand-word">First72</span>
            </span>
            <span className="topbar-title">{view.patientName}’s first 72 hours</span>
            <span className="clock num" aria-live="off">
              <Icon name="clock" size={16} />
              {clockText(view.nowH)}
            </span>
            <nav className="topbar-actions" aria-label="Plan actions">
              <button className="btn btn-quiet btn-small" onClick={() => setSharing(true)}>
                <Icon name="share" size={18} />
                <span>Share</span>
              </button>
              <button className="btn btn-quiet btn-small" onClick={() => window.print()}>
                <Icon name="print" size={18} />
                <span>Fridge sheet</span>
              </button>
              <button className="btn btn-quiet btn-small" onClick={() => onEdit(0)}>
                <Icon name="edit" size={18} />
                <span>Edit</span>
              </button>
            </nav>
          </div>
        </header>

        <main className="shell">
          {meName && (
            <div className="banner" role="status">
              <span>
                You’re viewing <b>{meName}</b>’s part of the plan.
              </span>
              <button
                className="btn btn-small"
                onClick={() => {
                  setOnlyMine(false);
                  onClearMe();
                }}
              >
                Show the whole plan
              </button>
            </div>
          )}
          {demo && !meName && (
            <div className="banner">
              <span>This is a sample family. Change the papers or the helpers and the plan rebuilds itself.</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-small" onClick={() => onEdit(1)}>
                  Edit the papers
                </button>
                <button className="btn btn-small" onClick={() => onEdit(2)}>
                  Edit the helpers
                </button>
              </span>
            </div>
          )}

          <section className="summary" aria-label="Summary">
            <p className="summary-lead">
              {view.patientName} comes home <strong>{view.when(0)}</strong>
              {uninsured ? ' without insurance' : ''}.{' '}
              {plan.coverage.required > 0 ? (
                plan.gaps.length ? (
                  <>
                    <strong>
                      {Math.round(plan.coverage.covered)} of {plan.coverage.required} hours
                    </strong>{' '}
                    have someone there, and <strong className="bad">{gapPhrase(view)}</strong> still {plan.gaps.length === 1 ? 'needs' : 'need'} someone.
                  </>
                ) : (
                  <>Every one of the {plan.coverage.required} hours has someone there.</>
                )
              ) : (
                <>The papers don’t ask for someone there around the clock.</>
              )}{' '}
              {uninsured ? (
                <>
                  The next 72 hours cost the family about <strong>{about(t.youPay)}</strong>
                  {chip > 1 ? `, or ${about(t.perChipIn)} each` : ''}
                  {t.benefits.high > 0 ? (
                    <>
                      , after about <strong className="good">{about(t.benefits)}</strong> of free help
                    </>
                  ) : null}
                  .{likely.length > 0 && (
                    <>
                      {' '}
                      Bigger savings: {view.patientName} likely qualifies for{' '}
                      <a href="#coverage" className="good" style={{ fontWeight: 760 }}>
                        {likely.length} {likely.length === 1 ? 'program' : 'programs'}
                      </a>
                      , starting with {likely[0]}.
                    </>
                  )}
                </>
              ) : (
                <>
                  Benefits can cover about <strong className="good">{about(t.benefits)}</strong>, leaving the family about <strong>{about(t.youPay)}</strong>
                  {chip > 1 ? `, or ${about(t.perChipIn)} each` : ''}.
                </>
              )}
              {heavy.length > 0 && (
                <>
                  {' '}
                  {heavy.map((l) => view.name(l.memberId)).join(' and ')} {heavy.length === 1 ? 'is' : 'are'} carrying too much, so the plan books a break.
                </>
              )}
            </p>
            <nav className="sections" aria-label="Sections">
              <a href="#runway">Runway</a>
              <a href="#tasks">{plural(plan.needs.filter((n) => !n.presence).length, 'task')}</a>
              <a href="#pays">Who pays</a>
              <a href="#coverage">Care and coverage</a>
              <a href="#helpers">Helpers</a>
              <a href="#help">Trusted help</a>
              <a href="#later">Next week</a>
            </nav>
          </section>

          <section className="section" id="runway" aria-labelledby="runway-title">
            <div className="section-head">
              <h2 id="runway-title">The 72-hour runway</h2>
              <p>Who is with {view.patientName} each hour, what happens when, and where nobody is covering yet.</p>
            </div>
            <Runway view={view} onPick={pick} />
          </section>

          {uninsured && coverage}

          <div className="body-grid">
            <section className="section" id="tasks" aria-labelledby="tasks-title">
              <div className="section-head">
                <h2 id="tasks-title">What the papers mean</h2>
                {me ? (
                  <label className="toggle">
                    <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                    Only {meName}’s tasks
                  </label>
                ) : (
                  <p>Every task points back to the line in the papers, or the answer, that created it.</p>
                )}
              </div>
              <Ledger view={view} highlight={highlight} onlyMember={onlyMine ? me : undefined} />
            </section>
            <aside className="section aside" id="pays" aria-label="Who pays">
              <WhoPays view={view} />
            </aside>
          </div>

          {!uninsured && coverage}

          <section className="section" id="helpers" aria-labelledby="helpers-title">
            <div className="section-head">
              <h2 id="helpers-title">Helpers</h2>
              <p>People nearby take the shifts and drives. People far away take the calls and payments. Send each person just their part.</p>
            </div>
            <CrewCards view={view} input={input} status={status} onToast={setToast} />
          </section>

          <section className="section" id="help" aria-labelledby="help-title">
            <div className="section-head">
              <h2 id="help-title">Trusted help</h2>
              <p>Paid help, judged on what matters this week: verified basics, price, and whether they can start before the gap.</p>
            </div>
            <Providers view={view} />
          </section>

          <section className="section" id="later" aria-labelledby="later-title">
            <div className="section-head">
              <h2 id="later-title">Start now for next week</h2>
              <p>These take days to set up. Starting today means they’re ready when the first 72 hours end.</p>
            </div>
            <ul className="later-list">
              {beyond.map((n) => (
                <li key={n.id}>
                  <b>{n.title}</b>
                  <span>
                    {view.ownerLabel(plan.assignments[n.id]?.owner ?? { kind: 'none' })}
                    {plan.assignments[n.id]?.service?.cost.high ? `. If paid: about ${moneyRange(plan.assignments[n.id].service!.cost)} ${n.costUnit ?? ''}` : ''}
                  </span>
                </li>
              ))}
              {later.map((c) => (
                <li key={c.sourceId}>
                  <b>{c.name}</b>
                  <span>Takes about {Math.max(1, Math.round((sourceById(c.sourceId).readyAt(plan.ctx) - plan.plannedH) / 24))} days to start. The script is under Calls to make.</span>
                </li>
              ))}
            </ul>
          </section>

          <footer className="footer">
            <p>
              First72 plans non-clinical help: rides, meals, chores, equipment, coverage and money. It does not give medical advice. For medical questions, call the number on the discharge papers. In an emergency, call 911.
            </p>
            <p>Costs are local estimates. Benefits vary by plan, so the call scripts ask the questions that confirm them.</p>
            <p>
              <button className="link" onClick={onReset}>
                Start over with a new plan
              </button>
            </p>
          </footer>
        </main>
        {sharing && <ShareSheet view={view} input={input} status={status} onClose={() => setSharing(false)} />}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
      <Fridge view={view} />
    </>
  );
}
