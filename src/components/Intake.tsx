import { useMemo, useRef, useState } from 'react';
import {
  buildBlocks,
  dayName,
  decode,
  PARTS,
  parseLocal,
  UNINSURED_PAPERS,
  type CaseInput,
  type CrewMember,
  type Distance,
  type Insurance,
  type Patient,
} from '../engine';
import { crewColor } from '../ui/format';
import { Icon } from './Icon';
import { BrandMark } from './Start';

const STEPS = ['Who’s coming home', 'Discharge papers', 'Who can help'];

const INSURANCE: Array<{ id: Insurance; label: string; hint: string }> = [
  { id: 'none', label: 'No insurance', hint: 'We’ll find free and low-cost help, and check what they qualify for' },
  { id: 'medicare', label: 'Original Medicare', hint: 'The red, white and blue card, with or without a supplement' },
  { id: 'medicare-advantage', label: 'Medicare Advantage', hint: 'A private Medicare plan with its own card' },
  { id: 'dual', label: 'Medicare and Medicaid', hint: 'Both, sometimes called dual eligible' },
  { id: 'medicaid', label: 'Medicaid only', hint: 'KanCare in Kansas' },
  { id: 'private', label: 'Job or marketplace plan', hint: 'Insurance through work or healthcare.gov' },
  { id: 'va', label: 'VA health care', hint: 'Care through Veterans Affairs' },
];

const DISTANCE: Array<{ id: Distance; label: string }> = [
  { id: 'home', label: 'Lives with them' },
  { id: 'near', label: 'Within 30 minutes' },
  { id: 'far', label: 'Far away (can help by phone)' },
];

interface Props {
  input: CaseInput;
  step: number;
  onChange: (input: CaseInput) => void;
  onStep: (step: number) => void;
  onDone: () => void;
  onExit: () => void;
}

export function Intake({ input, step, onChange, onStep, onDone, onExit }: Props) {
  const setPatient = (p: Partial<Patient>) => onChange({ ...input, patient: { ...input.patient, ...p } });
  const canNext = step === 0 ? input.patient.name.trim().length > 0 : step === 1 ? true : input.crew.some((m) => m.name.trim());

  return (
    <div className="shell intake">
      <nav className="intake-rail" aria-label="Plan steps">
        <button className="brand btn-quiet" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }} onClick={onExit}>
          <BrandMark />
          First72
        </button>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button aria-current={i === step ? 'step' : undefined} onClick={() => onStep(i)}>
                <span className="step-num">{i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main className="intake-main">
        {step === 0 && <PatientStep patient={input.patient} set={setPatient} />}
        {step === 1 && <PapersStep input={input} onChange={onChange} />}
        {step === 2 && <CrewStep input={input} onChange={onChange} />}

        <div className="intake-nav">
          <button className="btn" onClick={() => (step === 0 ? onExit() : onStep(step - 1))}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 2 ? (
            <button className="btn btn-primary" disabled={!canNext} onClick={() => onStep(step + 1)}>
              Next: {STEPS[step + 1].toLowerCase()}
            </button>
          ) : (
            <button className="btn btn-primary" disabled={!canNext} onClick={onDone}>
              Build the 72-hour plan
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function PatientStep({ patient, set }: { patient: Patient; set: (p: Partial<Patient>) => void }) {
  return (
    <>
      <h1>Who’s coming home?</h1>
      <p>A few facts decide which benefits apply. Nothing here leaves your browser.</p>
      <div className="form">
        <div className="row">
          <div className="field">
            <label htmlFor="p-name">Their name</label>
            <input id="p-name" className="input" value={patient.name} onChange={(e) => set({ name: e.target.value })} placeholder="Denise Carter" autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="p-pron">Pronouns for call scripts</label>
            <select id="p-pron" className="input" value={patient.pronouns} onChange={(e) => set({ pronouns: e.target.value as Patient['pronouns'] })}>
              <option value="she">she / her</option>
              <option value="he">he / his</option>
              <option value="they">they / their</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="p-age">Age</label>
            <input id="p-age" className="input num" type="number" min={18} max={110} value={patient.age} onChange={(e) => set({ age: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="p-zip">Home ZIP code</label>
            <input id="p-zip" className="input num" inputMode="numeric" maxLength={5} value={patient.zip} onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '') })} placeholder="66044" />
          </div>
          <div className="field">
            <label htmlFor="p-state">State</label>
            <select id="p-state" className="input" value={patient.state} onChange={(e) => set({ state: e.target.value })}>
              <option value="KS">Kansas</option>
              <option value="MO">Missouri</option>
              <option value="US">Another state</option>
            </select>
          </div>
        </div>
        <fieldset className="field">
          <legend>Their home situation</legend>
          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={patient.livesAlone} onChange={(e) => set({ livesAlone: e.target.checked })} />
              Lives alone
            </label>
            <label className="toggle">
              <input type="checkbox" checked={patient.veteran} onChange={(e) => set({ veteran: e.target.checked })} />
              Is a veteran
            </label>
            <label className="toggle">
              <input type="checkbox" checked={patient.hasHsaFsa} onChange={(e) => set({ hasHsaFsa: e.target.checked })} />
              Has an HSA or FSA
            </label>
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Household and income</legend>
          <span className="hint">Used only to check programs like charity care, sliding-fee clinics and food assistance. It stays on this device.</span>
          <div className="row">
            <div className="field">
              <label htmlFor="p-hh">People in the household</label>
              <input id="p-hh" className="input num" type="number" min={1} max={12} value={patient.householdSize} onChange={(e) => set({ householdSize: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
            <div className="field">
              <label htmlFor="p-inc">Monthly income before taxes (optional)</label>
              <input
                id="p-inc"
                className="input num"
                inputMode="numeric"
                placeholder="1700"
                value={patient.monthlyIncome ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, '');
                  set({ monthlyIncome: v === '' ? null : Number(v) });
                }}
              />
            </div>
          </div>
          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={patient.parent} onChange={(e) => set({ parent: e.target.checked })} />
              Has children under 19 at home
            </label>
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>Their health coverage</legend>
          <div className="choices">
            {INSURANCE.map((o) => (
              <label className="choice" key={o.id}>
                <input type="radio" name="insurance" checked={patient.insurance === o.id} onChange={() => set({ insurance: o.id })} />
                <b>{o.label}</b>
                <span>{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </>
  );
}

async function readPhoto(file: File, onProgress: (p: number) => void): Promise<string> {
  // Loaded only when someone scans, so the app stays small. Recognition runs on this device.
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

function PapersStep({ input, onChange }: { input: CaseInput; onChange: (i: CaseInput) => void }) {
  const findings = useMemo(() => decode(input.papers), [input.papers]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ocr, setOcr] = useState<{ state: 'idle' | 'reading' | 'error'; progress: number }>({ state: 'idle', progress: 0 });

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setOcr({ state: 'reading', progress: 0 });
    try {
      const text = await readPhoto(file, (p) => setOcr({ state: 'reading', progress: p }));
      onChange({ ...input, papers: [input.papers.trim(), text.trim()].filter(Boolean).join('\n') });
      setOcr({ state: 'idle', progress: 0 });
    } catch {
      setOcr({ state: 'error', progress: 0 });
    }
  };

  return (
    <>
      <h1>The discharge papers</h1>
      <p>Paste the instructions or scan a photo of them. Every task in the plan will point back to the line it came from.</p>
      <div className="form" style={{ maxWidth: 'none' }}>
        <div className="row" style={{ maxWidth: 420 }}>
          <div className="field">
            <label htmlFor="d-at">Discharge date and time</label>
            <input id="d-at" className="input num" type="datetime-local" value={input.dischargeAt} onChange={(e) => e.target.value && onChange({ ...input, dischargeAt: e.target.value })} />
          </div>
        </div>
        <div className="papers-grid">
          <div className="field">
            <label htmlFor="d-papers">Discharge instructions</label>
            <textarea
              id="d-papers"
              className="input"
              value={input.papers}
              onChange={(e) => onChange({ ...input, papers: e.target.value })}
              placeholder="Paste the Activity, Diet, Equipment and Follow-up sections here."
            />
            <div className="papers-tools">
              <button className="btn btn-small" onClick={() => fileRef.current?.click()} disabled={ocr.state === 'reading'}>
                <Icon name="camera" size={18} />
                Scan a photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scan(e.target.files?.[0])} />
              <button className="link" onClick={() => onChange({ ...input, papers: UNINSURED_PAPERS })}>
                Use sample papers
              </button>
              {ocr.state === 'reading' && <span className="ocr-status" role="status">Reading the photo on this device… {Math.round(ocr.progress * 100)}%</span>}
              {ocr.state === 'error' && (
                <span className="ocr-status error" role="alert">
                  That photo couldn’t be read. Try a flatter, brighter photo, or paste the text.
                </span>
              )}
            </div>
          </div>
          <aside className="preview" aria-live="polite">
            <h3>{findings.length ? `${findings.length} things that create work` : 'What the papers mean'}</h3>
            <p>{findings.length ? 'Each one becomes tasks in the plan.' : 'Restrictions show up here as you paste.'}</p>
            {findings.length > 0 && (
              <ul>
                {findings.map((f) => (
                  <li key={f.id}>
                    {f.label}
                    <span>{f.quote.length > 70 ? `${f.quote.slice(0, 68)}…` : f.quote}</span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

let idSeq = 0;
const newId = () => `p${Date.now().toString(36)}${idSeq++}`;

function CrewStep({ input, onChange }: { input: CaseInput; onChange: (i: CaseInput) => void }) {
  const t0 = parseLocal(input.dischargeAt);
  const blocks = useMemo(() => buildBlocks(parseLocal(input.dischargeAt)), [input.dischargeAt]);
  const days = [...new Set(blocks.map((b) => b.d))];
  const set = (id: string, patch: Partial<CrewMember>) => onChange({ ...input, crew: input.crew.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const add = () =>
    onChange({
      ...input,
      crew: [
        ...input.crew,
        { id: newId(), name: '', relation: '', distance: 'near', hasCar: true, canLift: true, backupCare: false, chipIn: false, availability: [] },
      ],
    });
  const remove = (id: string) => onChange({ ...input, crew: input.crew.filter((m) => m.id !== id) });

  return (
    <>
      <h1>Who can help?</h1>
      <p>
        Add everyone who might pitch in, including people far away. Mark when each person could be there. First72 builds shifts from this and shows where no one is covering.
      </p>
      <div className="form crew-edit" style={{ maxWidth: 860 }}>
        {input.crew.map((m, i) => {
          const c = crewColor(i);
          const toggle = (key: string) =>
            set(m.id, { availability: m.availability.includes(key) ? m.availability.filter((k) => k !== key) : [...m.availability, key] });
          return (
            <section className="person" key={m.id} aria-label={m.name || `Helper ${i + 1}`}>
              <div className="person-band" style={{ background: c }} />
              <div className="person-body">
                <div className="person-head">
                  <div className="field">
                    <label htmlFor={`n-${m.id}`}>Name</label>
                    <input id={`n-${m.id}`} className="input" value={m.name} onChange={(e) => set(m.id, { name: e.target.value })} placeholder={i === 0 ? 'You' : 'Name'} />
                  </div>
                  <div className="field">
                    <label htmlFor={`r-${m.id}`}>Relationship</label>
                    <input id={`r-${m.id}`} className="input" value={m.relation} onChange={(e) => set(m.id, { relation: e.target.value })} placeholder="Daughter, neighbor…" />
                  </div>
                  {input.crew.length > 1 && (
                    <button className="btn btn-quiet" onClick={() => remove(m.id)} aria-label={`Remove ${m.name || 'this person'}`}>
                      <Icon name="x" />
                    </button>
                  )}
                </div>
                <div className="row">
                  <div className="field">
                    <label htmlFor={`d-${m.id}`}>How far away</label>
                    <select id={`d-${m.id}`} className="input" value={m.distance} onChange={(e) => set(m.id, { distance: e.target.value as Distance })}>
                      {DISTANCE.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="toggles">
                  <label className="toggle">
                    <input type="checkbox" checked={m.hasCar} onChange={(e) => set(m.id, { hasCar: e.target.checked })} />
                    Can drive
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={m.canLift} onChange={(e) => set(m.id, { canLift: e.target.checked })} />
                    Can lift and carry
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={m.backupCare} onChange={(e) => set(m.id, { backupCare: e.target.checked })} />
                    Job offers backup care
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={m.chipIn} onChange={(e) => set(m.id, { chipIn: e.target.checked })} />
                    Will split costs
                  </label>
                </div>
                <div className="field">
                  <span className="field-label" id={`a-${m.id}`}>
                    {m.distance === 'far' ? 'When they can take calls' : 'When they can be there'}
                  </span>
                  <div className="avail">
                    <table aria-labelledby={`a-${m.id}`}>
                      <thead>
                        <tr>
                          <th />
                          {days.map((d) => (
                            <th key={d} scope="col">
                              {dayName(t0, d)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PARTS.map((p, pi) => (
                          <tr key={p.label}>
                            <th scope="row">
                              {p.label} <span className="hint">{p.range}</span>
                            </th>
                            {days.map((d) => {
                              const key = `${d}:${pi}`;
                              const exists = blocks.some((b) => b.key === key);
                              const on = m.availability.includes(key);
                              return (
                                <td key={key}>
                                  <button
                                    className="slot"
                                    style={{ ['--c' as string]: c }}
                                    aria-pressed={on}
                                    disabled={!exists}
                                    aria-label={`${dayName(t0, d, true)} ${p.label.toLowerCase()}`}
                                    onClick={() => toggle(key)}
                                  >
                                    {on ? 'Yes' : ''}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="papers-tools">
                    <button className="link" onClick={() => set(m.id, { availability: blocks.map((b) => b.key) })}>
                      Any time
                    </button>
                    <button className="link" onClick={() => set(m.id, { availability: blocks.filter((b) => b.p === 0 || b.p === 3).map((b) => b.key) })}>
                      Evenings and nights
                    </button>
                    <button className="link" onClick={() => set(m.id, { availability: [] })}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
        <button className="btn" onClick={add} style={{ justifySelf: 'start' }}>
          <Icon name="plus" size={18} />
          Add a helper
        </button>
      </div>
    </>
  );
}
