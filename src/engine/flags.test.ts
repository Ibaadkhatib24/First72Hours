import { describe, expect, it } from 'vitest';
import { decode } from './decoder';
import { headsUp } from './flags';
import { planCase } from './planner';
import { sampleCase, sampleMedicareCase, SAMPLE_PAPERS, UNINSURED_PAPERS } from './sample';

const NOW = new Date(2026, 9, 13, 9, 0);

describe('warning signs', () => {
  it('pulls the hospital’s own "when to get help" lines, word for word', () => {
    expect(decode(UNINSURED_PAPERS).filter((f) => f.rule === 'warning-signs').map((f) => f.quote)).toEqual([
      'Go to the emergency room for fever, spreading redness, or a blood sugar over 400.',
    ]);
    expect(decode(SAMPLE_PAPERS).filter((f) => f.rule === 'warning-signs').map((f) => f.quote)).toEqual([
      'Call your surgeon for fever over 101, new redness or drainage, or calf pain.',
      'Call 911 for chest pain or trouble breathing.',
    ]);
  });
});

describe('heads up for Denise (uninsured)', () => {
  const plan = planCase(sampleCase(NOW));
  const h = headsUp(plan, {}, plan.plannedH);
  const ids = h.flags.map((f) => f.id);

  it('flags the dangerous first-day problems first', () => {
    for (const id of ['ask-hospital', 'medicines', 'falls', 'supplies']) expect(ids).toContain(id);
    expect(h.flags.slice(0, 5).every((f) => f.level === 'now')).toBe(true);
    expect(h.flags.find((f) => f.id === 'medicines')!.title).toMatch(/cost/);
  });

  it('flags the uncovered hours, money and being alone later', () => {
    expect(ids.some((id) => id.startsWith('gap-'))).toBe(true);
    for (const id of ['bill', 'income', 'alone']) expect(ids).toContain(id);
  });

  it('clears a flag when its tasks are done and moves it to the end', () => {
    const after = headsUp(plan, { 'rx-price': 'done', rx: 'done' }, plan.plannedH);
    const med = after.flags.find((f) => f.id === 'medicines')!;
    expect(med.resolved).toBe(true);
    expect(after.flags[after.flags.length - 1].resolved).toBe(true);
    expect(after.open).toBe(h.open - 1);
  });

  it('clears a gap once the help that covers it is booked', () => {
    const gap = plan.gaps[0];
    const after = headsUp(plan, { [gap.id]: 'done' }, plan.plannedH);
    expect(after.flags.find((f) => f.id === `gap-${gap.id}`)!.resolved).toBe(true);
  });
});

describe('heads up for Rosa (Medicare)', () => {
  const plan = planCase(sampleMedicareCase(NOW));
  const h = headsUp(plan, {}, plan.plannedH);
  it('flags the paid ride, the overloaded daughter and the urgent benefit calls', () => {
    const ids = h.flags.map((f) => f.id);
    expect(ids).toContain('ride-fu-ride-0');
    expect(ids).toContain('load-maya');
    expect(ids.some((id) => id.startsWith('call-'))).toBe(true);
    expect(h.warnings.length).toBe(2);
  });
});
