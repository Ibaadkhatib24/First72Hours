import { useMemo } from 'react';
import { fmtWhen, planCase, sampleCase, type FindingRule } from '../engine';
import { Icon } from './Icon';

const SHOW: FindingRule[] = ['no-driving', 'lift-limit', 'bath-safety', 'supervision', 'diet', 'follow-up'];
const PREFER: Partial<Record<FindingRule, string[]>> = {
  'no-driving': ['therapy-rides', 'rides-later'],
  'lift-limit': ['household', 'groceries'],
  'bath-safety': ['kit', 'bath-setup'],
  'follow-up': ['fu-ride-0', 'fu-confirm-0', 'fu-book-0'],
};

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

export function Start({ onDemo, onNew }: { onDemo: () => void; onNew: () => void }) {
  // The hero is the product working on real (sample) papers, not an illustration of it.
  const lines = useMemo(() => {
    const plan = planCase(sampleCase());
    const names = Object.fromEntries(plan.ctx.crew.map((m) => [m.id, m.name]));
    return SHOW.map((rule) => plan.findings.find((f) => f.rule === rule))
      .filter((f) => !!f)
      .map((f) => {
        const cites = (n: (typeof plan.needs)[number]) => n.because.some((b) => b.kind === 'papers' && b.findingId === f.id);
        const preferred = (PREFER[f.rule] ?? []).map((id) => plan.needs.find((n) => n.id === id)).find((n) => n && cites(n));
        const need = preferred ?? plan.needs.find((n) => cites(n) && !n.beyond);
        let who = '';
        let when = '';
        if (f.rule === 'diet') {
          const benefit = plan.needs
            .flatMap((n) => plan.assignments[n.id]?.parts ?? [])
            .find((p) => p.paid === 'benefit');
          if (benefit && benefit.owner.kind === 'service') {
            return { quote: f.quote, who: benefit.owner.name, when: `Covered meals from ${fmtWhen(plan.t0, benefit.at)}, family cooks until then` };
          }
        }
        if (need?.presence) {
          who = `${plan.coverage.covered} of ${plan.coverage.required} hours covered`;
          when = `Shifts built from everyone’s availability, ${plan.gaps.length} ${plan.gaps.length === 1 ? 'gap' : 'gaps'} found`;
        } else if (need) {
          const a = plan.assignments[need.id];
          who = a.owner.kind === 'crew' ? names[a.owner.memberId] : a.owner.kind === 'service' ? a.owner.name : 'Needs someone';
          when = need.beyond ? `${need.title}, starting today` : `${need.title}, ${fmtWhen(plan.t0, a.at)}`;
        }
        return { quote: f.quote, who, when };
      });
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
          First72 reads them and works out the rest: who does each thing in the first 72 hours home, where nobody is covering, and which benefits pay for it.
        </p>
        <div className="start-actions">
          <button className="btn btn-primary" onClick={onDemo}>
            See Rosa’s plan
          </button>
          <button className="btn" onClick={onNew}>
            Start a plan for my family
          </button>
        </div>
        <p className="start-note">
          <Icon name="lock" size={16} />
          Everything runs in your browser. Nothing you type leaves this device unless you share the link.
        </p>
      </div>

      <figure className="paper" aria-label="Sample discharge papers with highlighted restrictions and what First72 planned for each">
        <div className="paper-head">Discharge instructions, Rosa Alvarez, right hip replacement</div>
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
