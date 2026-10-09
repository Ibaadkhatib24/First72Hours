import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sourceById, type CaseInput, type Plan, type Status, type TabId } from '../engine';
import { useNow } from '../state';
import { moneyRange } from '../ui/format';
import { makeView } from '../ui/view';
import { CareCoverage } from './CareCoverage';
import { CrewCards } from './CrewCards';
import { Fridge } from './Fridge';
import { HeadsUpPage } from './HeadsUpList';
import { Home, ScheduleList } from './Home';
import { Icon } from './Icon';
import { Ledger } from './Ledger';
import { Providers } from './Providers';
import { Runway } from './Runway';
import { ShareSheet } from './ShareSheet';
import { BrandMark } from './Start';
import { isTab, PageHead, TabBar } from './Tabs';
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

const tabFromHash = (): TabId => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '');
  return isTab(h) ? h : 'home';
};

// Text size for people who need it bigger. Kept on this device only.
const SIZES = [1, 1.15, 1.3];
const loadSize = () => {
  try {
    const v = Number(localStorage.getItem('first72:size'));
    return SIZES.includes(v) ? v : 1;
  } catch {
    return 1;
  }
};

export function PlanView({ plan, input, status, me, demo, onStatus, onInput, onEdit, onClearMe, onReset }: Props) {
  const now = useNow();
  const [tab, setTab] = useState<TabId>(tabFromHash);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | undefined>();
  const [onlyMine, setOnlyMine] = useState(!!me);
  const [mode, setMode] = useState<'time' | 'type'>('time');
  const [hideDone, setHideDone] = useState(false);
  const [size, setSize] = useState(loadSize);
  const pending = useRef<string | undefined>(undefined);

  // Tabs live in the address bar, so the browser's back button works.
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const id = pending.current;
    pending.current = undefined;
    if (id) {
      setHighlight(id);
      requestAnimationFrame(() => document.getElementById(`task-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      const t = setTimeout(() => setHighlight(undefined), 2600);
      return () => clearTimeout(t);
    }
    window.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const go = useCallback((next: TabId, needId?: string) => {
    if (needId && next === 'todo') {
      setOnlyMine(false);
      setHideDone(false);
      pending.current = needId;
    }
    if (next === tabFromHash()) {
      // Same tab: just point at the task.
      setTab(next);
      if (needId) {
        setHighlight(needId);
        requestAnimationFrame(() => document.getElementById(`task-${needId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        setTimeout(() => setHighlight(undefined), 2600);
      }
      return;
    }
    location.hash = next;
  }, []);

  const view = useMemo(() => makeView(plan, input, status, onStatus, now, go), [plan, input, status, onStatus, now, go]);

  const bumpSize = () => {
    const next = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
    setSize(next);
    try {
      localStorage.setItem('first72:size', String(next));
    } catch {
      // Saving the size is only a convenience.
    }
  };

  const meName = me ? view.name(me) : undefined;
  const later = plan.calls.filter((c) => c.status === 'later');
  const beyond = plan.needs.filter((n) => n.beyond);

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="shell topbar-inner">
            <a className="brand" href="#home" style={{ textDecoration: 'none' }}>
              <BrandMark />
              <span className="brand-word">First72</span>
            </a>
            <span className="topbar-title">{view.patientName}’s first 72 hours</span>
            <span className="clock num" aria-live="off">
              <Icon name="clock" size={16} />
              {clockText(view.nowH)}
            </span>
            <nav className="topbar-actions" aria-label="Plan actions">
              <button className="btn btn-quiet btn-small" onClick={bumpSize} aria-label={`Text size: ${size === 1 ? 'normal' : size === SIZES[1] ? 'large' : 'largest'}. Change it`}>
                <Icon name="text" size={20} />
                <span>{size === 1 ? 'Bigger text' : size === SIZES[1] ? 'Even bigger' : 'Normal text'}</span>
              </button>
              <button className="btn btn-quiet btn-small" onClick={() => setSharing(true)}>
                <Icon name="share" size={18} />
                <span>Share</span>
              </button>
              <button className="btn btn-quiet btn-small" onClick={() => window.print()}>
                <Icon name="print" size={18} />
                <span>Print</span>
              </button>
              <button className="btn btn-quiet btn-small" onClick={() => onEdit(0)}>
                <Icon name="edit" size={18} />
                <span>Edit</span>
              </button>
            </nav>
          </div>
        </header>

        <div className="app-body" style={{ zoom: size }}>
          <TabBar view={view} tab={tab} />

          <main className="shell page">
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

            {tab === 'home' ? <Home view={view} demo={demo} onEdit={onEdit} /> : <PageHead tab={tab} view={view} />}

            {tab === 'alerts' && <HeadsUpPage view={view} />}

            {tab === 'schedule' && (
              <>
                <Runway view={view} onPick={(id) => go('todo', id)} />
                <ScheduleList view={view} />
              </>
            )}

            {tab === 'todo' && (
              <>
                <div className="list-controls">
                  <div className="seg" role="group" aria-label="Sort the list">
                    <button aria-pressed={mode === 'time'} onClick={() => setMode('time')}>
                      By time
                    </button>
                    <button aria-pressed={mode === 'type'} onClick={() => setMode('type')}>
                      By type of help
                    </button>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
                    Hide finished tasks
                  </label>
                  {me && (
                    <label className="toggle">
                      <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                      Only {meName}’s tasks
                    </label>
                  )}
                </div>
                <Ledger view={view} highlight={highlight} onlyMember={onlyMine ? me : undefined} mode={mode} hideDone={hideDone} />
              </>
            )}

            {tab === 'money' && (
              <div className="single">
                <WhoPays view={view} />
              </div>
            )}

            {tab === 'coverage' && <CareCoverage view={view} input={input} onInput={onInput} />}

            {tab === 'helpers' && <CrewCards view={view} input={input} status={status} onToast={setToast} />}

            {tab === 'hire' && <Providers view={view} />}

            {tab === 'later' && (
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
                    <span>
                      Takes about {Math.max(1, Math.round((sourceById(c.sourceId).readyAt(plan.ctx) - plan.plannedH) / 24))} days to start. The script is under{' '}
                      <a href="#money">Money</a>.
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <footer className="footer">
              <p>
                First72 plans non-clinical help: rides, meals, chores, equipment, coverage and money. It does not give medical advice. For medical questions, call the number on the discharge papers. In an emergency, call 911.
              </p>
              <p>
                <button className="link" onClick={onReset}>
                  Start over with a new plan
                </button>
              </p>
            </footer>
          </main>
        </div>
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
