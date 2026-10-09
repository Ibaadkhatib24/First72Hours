import { describe, expect, it } from 'vitest';
import { fplAnnual, fplPercent, openEnrollment, screen } from './eligibility';
import { sampleCase } from './sample';

const base = () => sampleCase(new Date(2026, 9, 13, 9)).patient;
const status = (p: ReturnType<typeof base>, id: string) => screen(p, new Date(2026, 9, 13)).programs.find((x) => x.id === id)?.status;

describe('poverty line math', () => {
  it('uses the 2026 guidelines', () => {
    expect(fplAnnual(1)).toBe(15_960);
    expect(fplAnnual(4)).toBe(33_000);
    expect(fplPercent({ monthlyIncome: 1700, householdSize: 1 })).toBe(128);
    expect(fplPercent({ monthlyIncome: null, householdSize: 3 })).toBeUndefined();
  });
});

describe('screen', () => {
  it('Kansas: no Medicaid for adults without kids, Marketplace instead', () => {
    const p = base();
    expect(status(p, 'medicaid')).toBe('unlikely');
    expect(status(p, 'marketplace')).toBe('likely');
    expect(status(p, 'hospital-fa')).toBe('likely');
    expect(status(p, 'snap')).toBe('likely');
  });

  it('Missouri: the same person likely qualifies for Medicaid', () => {
    const p = { ...base(), state: 'MO' };
    expect(status(p, 'medicaid')).toBe('likely');
    expect(status(p, 'marketplace')).toBe('unlikely');
  });

  it('Kansas coverage gap below the poverty line', () => {
    const p = { ...base(), monthlyIncome: 900 };
    const m = screen(p, new Date(2026, 9, 13)).programs.find((x) => x.id === 'marketplace')!;
    expect(m.status).toBe('unlikely');
    expect(m.why).toMatch(/coverage gap/);
  });

  it('names the local health center for Lawrence ZIP codes', () => {
    expect(screen(base()).programs.find((x) => x.id === 'fqhc')!.contact.phone).toBe('785-841-7297');
    const elsewhere = screen({ ...base(), zip: '67202' }).programs.find((x) => x.id === 'fqhc')!;
    expect(elsewhere.contact.url).toContain('findahealthcenter.hrsa.gov');
  });

  it('knows when open enrollment runs', () => {
    expect(openEnrollment(new Date(2026, 9, 9)).open).toBe(false);
    expect(openEnrollment(new Date(2026, 10, 20)).open).toBe(true);
    expect(openEnrollment(new Date(2027, 0, 10)).open).toBe(true);
    expect(openEnrollment(new Date(2027, 1, 1)).open).toBe(false);
  });
});
