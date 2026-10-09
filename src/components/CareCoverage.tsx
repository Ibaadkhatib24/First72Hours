import { useState } from 'react';
import { fplAnnual, type CaseInput, type Program } from '../engine';
import { money } from '../ui/format';
import type { View } from '../ui/view';
import { Icon } from './Icon';
import { copyText } from './Script';
import { StatusControl } from './Status';

const LABEL = { likely: 'Likely', maybe: 'Maybe', unlikely: 'Not likely' } as const;
const ORDER = { likely: 0, maybe: 1, unlikely: 2 } as const;

function ProgramCard({ p, view }: { p: Program; view: View }) {
  const [copied, setCopied] = useState(false);
  const key = `prog:${p.id}`;
  const tel = p.contact.phone?.replace(/[^\d+]/g, '');
  return (
    <article className={`program ${p.status}`}>
      <div className="program-top">
        <h3>{p.name}</h3>
        <span className={`chip ${p.status}`}>{LABEL[p.status]}</span>
      </div>
      {p.when && <span className="program-when">{p.when}</span>}
      <p className="program-why">{p.why}</p>
      {p.status !== 'unlikely' || p.id === 'medicaid' ? <p className="program-next">{p.next}</p> : null}
      <div className="program-contact">
        <b>{p.contact.who}</b>
        {p.contact.phone && (
          <a href={`tel:${tel}`} className="num">
            {p.contact.phone}
          </a>
        )}
        {p.contact.url && (
          <a href={p.contact.url} target="_blank" rel="noreferrer">
            {p.contact.url.replace(/^(https?:\/\/|mailto:)/, '').replace(/\/$/, '')}
          </a>
        )}
      </div>
      {p.status !== 'unlikely' && (
        <details>
          <summary className="link" style={{ textDecoration: 'none', fontSize: 14 }}>
            What to say
          </summary>
          <div className="script" style={{ marginTop: 8 }}>
            <blockquote>“{p.script}”</blockquote>
            <div className="script-actions">
              <button
                className="btn btn-small"
                onClick={async () => {
                  setCopied(await copyText(p.script));
                  setTimeout(() => setCopied(false), 1800);
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={16} />
                {copied ? 'Copied' : 'Copy script'}
              </button>
              {tel && (
                <a className="btn btn-small" href={`tel:${tel}`}>
                  <Icon name="phone" size={16} />
                  Call
                </a>
              )}
            </div>
          </div>
        </details>
      )}
      {p.status !== 'unlikely' && (
        <StatusControl value={view.status[key] ?? 'todo'} onChange={(s) => view.setStatus(key, s)} labels={{ todo: 'To do', asked: 'Started', done: 'Done' }} label={`Status of ${p.name}`} />
      )}
    </article>
  );
}

export function CareCoverage({ view, input, onInput }: { view: View; input: CaseInput; onInput: (i: CaseInput) => void }) {
  const { screening } = view.plan;
  const p = input.patient;
  const programs = [...screening.programs].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const state = p.state.toUpperCase();
  const canCompare = state === 'KS' || state === 'MO';
  return (
    <>
      <div className="coverage-facts">
        <p>
          {screening.fpl !== undefined ? (
            <>
              Household of {p.householdSize}, about <b className="num">{money(p.monthlyIncome ?? 0)}</b> a month: <b className="num">{screening.fpl}%</b> of the 2026 poverty line ({money(fplAnnual(p.householdSize))} a year).
            </>
          ) : (
            <>Add household income in the intake to get sharper answers. It never leaves this device.</>
          )}{' '}
          {screening.uninsured ? 'No insurance today.' : ''}
        </p>
        {canCompare && screening.uninsured && (
          <div className="compare" role="group" aria-label="Compare states">
            <span>Across State Line Road:</span>
            {(['KS', 'MO'] as const).map((s) => (
              <button key={s} aria-pressed={state === s} onClick={() => onInput({ ...input, patient: { ...p, state: s } })}>
                {s === 'KS' ? 'Kansas' : 'Missouri'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="programs">
        {programs.map((x) => (
          <ProgramCard key={x.id} p={x} view={view} />
        ))}
      </div>
      <p className="sample-note" style={{ marginTop: 12 }}>
        A screener, not a decision. Programs make the final call, so the scripts ask the questions that confirm it.
      </p>
    </>
  );
}
