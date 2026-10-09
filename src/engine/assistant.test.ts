import { describe, expect, it } from 'vitest';
import { localAnswer, planBrief, safetyReply, suggestions, type AskCtx } from './assistant';
import { planCase } from './planner';
import { sampleCase, sampleMedicareCase } from './sample';

const NOW = new Date(2026, 9, 13, 9, 0);

function ctx(input = sampleCase(NOW), status: AskCtx['status'] = {}): AskCtx {
  const plan = planCase(input);
  return { plan, input, status, nowH: plan.plannedH };
}

const ask = (q: string, a = ctx()) => localAnswer(a, q);

describe('safety comes first', () => {
  it('sends emergencies to 911 before anything else', () => {
    for (const q of ['She has chest pain', 'he can’t breathe', 'Mom passed out', 'she fell and hit her head']) {
      const r = ask(q);
      expect(r.kind, q).toBe('safety');
      expect(r.text, q).toMatch(/call 911 now/i);
    }
  });

  it('never answers medical questions, and quotes the papers instead', () => {
    for (const q of ['How much insulin should she take?', 'Is it normal that her foot is swollen?', 'She has a fever of 100', 'Can she take ibuprofen?', 'her blood sugar is 320', 'She is in a lot of pain']) {
      const r = ask(q);
      expect(r.kind, q).toBe('safety');
      expect(r.text, q).toMatch(/can't answer medical questions/);
      expect(r.text, q).toMatch(/number on Denise's discharge papers/);
    }
    // Denise's warning-sign line is quoted word for word.
    expect(ask('Is it normal that her foot is red?').text).toContain('"Go to the emergency room for fever, spreading redness, or a blood sugar over 400."');
  });

  it('gives 988 for a crisis', () => {
    const r = ask('I want to kill myself');
    expect(r.kind).toBe('safety');
    expect(r.text).toMatch(/988/);
  });

  it('does not treat money or pickup questions as medical', () => {
    expect(safetyReply(ctx(), 'How much will the medicine cost?')).toBeNull();
    expect(safetyReply(ctx(), 'When do we pick up the prescriptions?')).toBeNull();
    expect(safetyReply(ctx(), 'How do I prevent falls?')).toBeNull();
  });
});

describe('answers from the plan', () => {
  it('handles every suggested question without a key', () => {
    const a = ctx();
    for (const q of suggestions(a)) expect(localAnswer(a, q).kind, q).not.toBe('fallback');
  });

  it('says what to do next, with owners and times', () => {
    const r = ask('What should I do next?');
    expect(r.topic).toBe('next');
    expect(r.text).toMatch(/Marcus/);
    expect(r.links[0]).toMatchObject({ tab: 'todo' });
  });

  it('knows who is there tonight and spots the gap', () => {
    const r = ask('Who is with Denise tonight?');
    expect(r.topic).toBe('who');
    expect(r.text).toMatch(/Tasha/);
    const gaps = ask('When is nobody there?');
    expect(gaps.topic).toBe('gaps');
    expect(gaps.text).toMatch(/12pm.2pm/);
  });

  it('marks the gap covered once it is booked', () => {
    const a = ctx();
    const g = a.plan.gaps[0];
    expect(localAnswer({ ...a, status: { [g.id]: 'done' } }, 'Are there any gaps?').text).toMatch(/Every hour that needs someone is covered/);
  });

  it('answers money, coverage and calls with real numbers', () => {
    expect(ask('How much will this cost?').text).toMatch(/\$\d+/);
    const cov = ask('What help can Denise get?');
    expect(cov.topic).toBe('coverage');
    expect(cov.text).toMatch(/financial assistance/i);
    expect(cov.text).toMatch(/785-841-7297/);
    expect(ask('Who do I call?').text).toMatch(/Food pantry/);
  });

  it('gives a helper their own list', () => {
    const r = ask('What does Marcus need to do?');
    expect(r.topic).toBe('person');
    expect(r.text).toMatch(/far away|tasks/);
    expect(r.text).toMatch(/cash price/);
  });

  it('is kind about burnout and points at real hand-offs', () => {
    const r = ask('I’m exhausted. What can I do?');
    expect(r.topic).toBe('tired');
    expect(r.text).toMatch(/Tasha/);
    expect(r.text).toMatch(/211/);
  });

  it('works for an insured family too', () => {
    const a = ctx(sampleMedicareCase(NOW));
    expect(localAnswer(a, 'How will Rosa get to her appointment?').topic).toBe('rides');
    expect(localAnswer(a, 'What should I do next?').kind).toBe('plan');
  });

  it('falls back with suggestions instead of guessing', () => {
    const r = ask('What is the capital of France?');
    expect(r.kind).toBe('fallback');
    expect(r.text).toMatch(/What should I do next\?/);
  });
});

describe('plan brief for Claude', () => {
  it('includes the facts Claude needs and the exact quotes', () => {
    const b = planBrief(ctx(), NOW);
    expect(b).toMatch(/Patient: Denise, 56/);
    expect(b).toMatch(/no insurance/);
    expect(b).toMatch(/NOBODY YET/);
    expect(b).toMatch(/"Go to the emergency room for fever/);
    expect(b).toMatch(/Heartland/);
    expect(b.length).toBeLessThan(16000);
  });
});
