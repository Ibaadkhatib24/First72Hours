import { describe, expect, it } from 'vitest';
import { mid, planCase } from './planner';
import { sampleCase } from './sample';
import { toLocalIso } from './time';
import type { CaseInput } from './types';

// Tuesday 9am, so discharge is Tuesday 2pm and planning starts at 10am.
const NOW = new Date(2026, 9, 13, 9, 0);
const sample = () => sampleCase(NOW);

describe('planCase on the sample family', () => {
  const plan = planCase(sample());

  it('every need cites a reason', () => {
    for (const n of plan.needs) expect(n.because.length).toBeGreaterThan(0);
  });

  it('covers all 72 hours except the two weekday afternoons', () => {
    expect(plan.coverage.required).toBe(72);
    expect(plan.gaps.map((g) => [g.start, g.end])).toEqual([
      [22, 28],
      [46, 52],
    ]);
  });

  it('fills the gaps with backup care from Maya’s job, which can start in time', () => {
    for (const g of plan.gaps) {
      expect(g.funding.provider?.sourceId).toBe('employer-backup');
      expect(g.funding.unfillable).toBeFalsy();
    }
  });

  it('flags Maya as overloaded and suggests relief', () => {
    const maya = plan.loads.find((l) => l.memberId === 'maya')!;
    expect(maya.level).toBe('overloaded');
    expect(maya.overnights).toBe(3);
    expect(maya.relief).toBeDefined();
  });

  it('gives phone and online tasks to the son who lives far away', () => {
    for (const id of ['kit', 'group-text', 'fu-confirm-0', 'therapy-book']) {
      expect(plan.assignments[id].owner).toEqual({ kind: 'crew', memberId: 'dev' });
    }
  });

  it('never gives a driving task to someone without a car', () => {
    for (const n of plan.needs.filter((x) => x.req.car)) {
      const o = plan.assignments[n.id].owner;
      if (o.kind === 'crew') expect(sample().crew.find((m) => m.id === o.memberId)!.hasCar).toBe(true);
    }
  });

  it('pairs the pharmacy stop with the drive home', () => {
    expect(plan.assignments.rx.owner).toEqual(plan.assignments.arrival.owner);
  });

  it('books a paid ride when no one can drive to the follow-up', () => {
    const ride = plan.assignments['fu-ride-0'];
    expect(ride.owner.kind).toBe('service');
    expect(ride.service?.youPay.low).toBeGreaterThan(0);
  });

  it('uses plan meals only once they can arrive', () => {
    const thu = plan.assignments['meals-2'];
    expect(thu.benefitShare).toMatchObject({ count: 2, total: 3 });
    const fri = plan.assignments['meals-3'];
    expect(fri.owner).toMatchObject({ kind: 'service', sourceId: 'ma-meals' });
  });

  it('adds up benefits, family share and the early-start bonus', () => {
    expect(mid(plan.totals.benefits)).toBeGreaterThan(300);
    expect(plan.totals.youPay.low).toBeLessThan(plan.totals.cost.low);
    expect(plan.totals.chipIns).toBe(2);
    expect(plan.earlyBonus).toBeGreaterThan(0);
  });

  it('lists the calls to make, counted benefits first', () => {
    expect(plan.calls[0].status).toBe('counted');
    const rides = plan.calls.find((c) => c.sourceId === 'ma-rides')!;
    expect(rides.tooSlowFor.some((x) => x.includes('Dr. Patel'))).toBe(true);
    expect(plan.calls.find((c) => c.sourceId === 'aaa-meals')?.status).toBe('later');
  });

  it('no one is booked for two tasks at once', () => {
    const byMember = new Map<string, Array<[number, number, string]>>();
    for (const n of plan.needs) {
      const a = plan.assignments[n.id];
      if (!a || a.owner.kind !== 'crew' || a.parts) continue;
      const list = byMember.get(a.owner.memberId) ?? [];
      list.push([a.at, a.at + n.duration, n.pairWith ?? n.id]);
      byMember.set(a.owner.memberId, list);
    }
    for (const list of byMember.values()) {
      list.sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < list.length; i++) {
        const [s, , id] = list[i];
        const [, e, prevId] = list[i - 1];
        if (id === prevId || list[i][2] === 'arrival' || list[i - 1][2] === 'arrival') continue;
        expect(s).toBeGreaterThanOrEqual(e - 1e-9);
      }
    }
  });
});

describe('planCase edge cases', () => {
  it('turns a family with no one nearby into a gap with paid help', () => {
    const input: CaseInput = sample();
    input.crew = input.crew.filter((m) => m.id === 'dev');
    const plan = planCase(input);
    expect(plan.coverage.covered).toBe(0);
    // Help that needs a day's notice can't cover the first hours.
    expect(plan.gaps[0].funding.unfillable).toBe(true);
    expect(plan.assignments.arrival.owner.kind).toBe('service');
  });

  it('planning two days early unlocks more benefits than planning at discharge', () => {
    const early = sample();
    const t0 = new Date(early.dischargeAt);
    early.plannedAt = toLocalIso(new Date(t0.getTime() - 48 * 3_600_000));
    const late = sample();
    late.plannedAt = late.dischargeAt;
    expect(mid(planCase(early).totals.benefits)).toBeGreaterThan(mid(planCase(late).totals.benefits));
  });

  it('works for Medicaid: rides become covered when there is enough notice', () => {
    const input = sample();
    input.patient.insurance = 'dual';
    input.plannedAt = toLocalIso(new Date(new Date(input.dischargeAt).getTime() - 48 * 3_600_000));
    const plan = planCase(input);
    const ride = plan.assignments['fu-ride-0'];
    expect(ride.service?.provider?.sourceId).toBe('medicaid-nemt');
    expect(ride.service?.youPay.high).toBe(0);
  });

  it('plans a first-night stay when the patient lives alone with no supervision order', () => {
    const input = sample();
    input.papers = 'Walk with your walker. Resume your regular diet.';
    const plan = planCase(input);
    expect(plan.needs.find((n) => n.id === 'presence')?.title).toMatch(/first night/);
    expect(plan.needs.some((n) => n.id.startsWith('checkin-'))).toBe(true);
  });

  it('handles empty papers without crashing', () => {
    const input = sample();
    input.papers = '';
    const plan = planCase(input);
    expect(plan.findings).toEqual([]);
    expect(plan.needs.length).toBeGreaterThan(0);
  });
});
