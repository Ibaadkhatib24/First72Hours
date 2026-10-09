import { useMemo } from 'react';
import { fmtWhen, planCase, sampleCase } from '../engine';
import { Icon } from './Icon';

// Which lines of Denise's papers to annotate on the start screen, and which task to show for each.
const SHOW: Array<{ finding: string; need?: string }> = [
  { finding: 'supervision-0' },
  { finding: 'no-work-0', need: 'apply-snap' },
  { finding: 'supplies-1', need: 'kit' },
  { finding: 'diet-0', need: 'groceries' },
  { finding: 'follow-up-0', need: 'fu-ride-0' },
  { finding: 'follow-up-1', need: 'fu-book-1' },
];

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1a2240" />
      <path d="M8 40h48" stroke="#f2c39d" strokeWidth="5" strokeLinecap="round" />
      <circle cx="22" cy="40" r="7" fill="#f2c39d" />
      <path d="M38 24l6-6 6 6" stroke="#d6e8f6" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Start({ onDemo, onNew }: { onDemo: (kind: 'uninsured' | 'medicare') => void; onNew: () => void }) {
  // The hero is the product working on real (sample) papers, not an illustration of it.
  const lines = useMemo(() => {
    const plan = planCase(sampleCase());
    const names = Object.fromEntries(plan.ctx.crew.map((m) => [m.id, m.name]));
    return SHOW.map(({ finding, need: needId }) => {
      const f = plan.findings.find((x) => x.id === finding);
      if (!f) return null;
      if (f.rule === 'supervision') {
        return {
          quote: f.quote,
          who: `${plan.coverage.covered} of ${plan.coverage.required} hours covered`,
          when: `Shifts from everyone’s free time, ${plan.gaps.length} ${plan.gaps.length === 1 ? 'gap' : 'gaps'} found`,
        };
      }
      const need = plan.needs.find((n) => n.id === needId);
      if (!need) return null;
      const a = plan.assignments[need.id];
      const who = a.owner.kind === 'crew' ? names[a.owner.memberId] : a.owner.kind === 'service' ? a.owner.name : 'Needs someone';
      const free = a.items?.layers.find((l) => l.kind === 'community' || l.kind === 'program');
      const when = need.beyond ? `${need.title}, this week` : `${need.title}, ${fmtWhen(plan.t0, a.at)}${free ? `. Free from the ${free.name.toLowerCase()}` : ''}`;
      return { quote: f.quote, who, when };
    }).filter((x): x is { quote: string; who: string; when: string } => !!x);
  }, []);

  return (
    <main className="shell start">
      <div className="start-copy">
        <div className="brand">
          <BrandMark />
          First72
        </div>
        <h1>Discharge papers list what Mom can’t do.</h1>
        <p className="start-lede">
          First72 reads them and works out the rest: who does each thing in the first 72 hours home, where nobody is covering, and what’s free or cheap, even without insurance.
        </p>
        <div className="start-actions">
          <button className="btn btn-primary" onClick={() => onDemo('uninsured')}>
            See Denise’s plan
          </button>
          <button className="btn" onClick={onNew}>
            Start a plan for my family
          </button>
        </div>
        <p className="start-alt">
          Denise is 56 and has no insurance.{' '}
          <button className="link" onClick={() => onDemo('medicare')}>
            Or see Rosa, 74, on Medicare Advantage
          </button>
        </p>
        <p className="start-note">
          <Icon name="lock" size={16} />
          Everything runs in your browser. Nothing you type leaves this device unless you share the link.
        </p>
      </div>

      <figure className="paper" aria-label="Sample discharge papers with highlighted restrictions and what First72 planned for each">
        <div className="paper-head">Discharge instructions, Denise Carter, right foot infection and new diabetes</div>
        {lines.map((l, i) => (
          <div className="paper-line" key={i} style={{ ['--i' as string]: i }}>
            <span>
              <mark>{l.quote}</mark>
            </span>
            <span className="paper-note">
              <b>{l.who}</b>
              <br />
              {l.when}
            </span>
          </div>
        ))}
      </figure>
    </main>
  );
}
