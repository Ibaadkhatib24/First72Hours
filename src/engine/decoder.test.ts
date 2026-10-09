import { describe, expect, it } from 'vitest';
import { decode, parseDuration, sentences } from './decoder';
import { SAMPLE_PAPERS, UNINSURED_PAPERS } from './sample';

const rules = (text: string) => decode(text).map((f) => f.rule);

describe('parseDuration', () => {
  it('reads digits and number words', () => {
    expect(parseDuration('for the first 72 hours')).toEqual({ hours: 72, phrase: '72 hours' });
    expect(parseDuration('for two days')).toEqual({ hours: 48, phrase: '2 days' });
    expect(parseDuration('for 6 weeks')?.hours).toBe(6 * 168);
  });
  it('returns undefined without a duration', () => {
    expect(parseDuration('until cleared by your surgeon')).toBeUndefined();
  });
});

describe('sentences', () => {
  it('keeps "Dr. Patel" in one sentence and skips headings', () => {
    const s = sentences('FOLLOW-UP\n- Follow up with Dr. Patel in 2 days. Bring your list.');
    expect(s.map((x) => x.text)).toEqual(['Follow up with Dr. Patel in 2 days.', 'Bring your list.']);
  });
});

describe('decode', () => {
  it('finds every restriction in the sample papers and cites the exact sentence', () => {
    const found = decode(SAMPLE_PAPERS);
    const byRule = Object.fromEntries(found.map((f) => [f.rule, f]));
    expect(Object.keys(byRule).sort()).toEqual(
      [
        'adl-aids', 'bath-safety', 'bending', 'diet', 'fall-risk', 'follow-up', 'home-health', 'lift-limit',
        'mobility-device', 'no-driving', 'prescriptions', 'stairs', 'supervision', 'therapy', 'warning-signs',
      ].sort(),
    );
    expect(byRule.supervision.params.hours).toBe(72);
    expect(byRule['lift-limit'].label).toBe("Can't lift more than 10 lb");
    expect(byRule['follow-up'].params).toMatchObject({ doctor: 'Dr. Patel', dayOffset: 2, specialty: 'Orthopedics' });
    expect(byRule['bath-safety'].params.items).toEqual(['raised toilet seat', 'shower chair']);
    expect(byRule.therapy.params).toMatchObject({ perWeek: 3, startsWithinH: 168 });
    for (const f of found) expect(SAMPLE_PAPERS).toContain(f.quote);
  });

  it('does not flag driving unless it is restricted', () => {
    expect(rules('Your daughter can drive you home.')).not.toContain('no-driving');
    expect(rules('Do not drive while taking pain medicine.')).toContain('no-driving');
  });

  it('handles follow-ups beyond the 72-hour window', () => {
    const [f] = decode('See your cardiologist within 2 weeks.');
    expect(f.rule).toBe('follow-up');
    expect(f.params.beyond).toBe(true);
    expect(f.params.beyondPhrase).toBe('2 weeks');
    expect(f.params.doctor).toBe('the cardiologist');
  });

  it('reads weekday appointments with a time', () => {
    const [f] = decode('Your follow-up appointment is on Friday at 2:30 pm with Dr. Okafor.');
    expect(f.params).toMatchObject({ weekday: 5, hour: 14.5, doctor: 'Dr. Okafor' });
  });

  it('reads a heart-failure style discharge', () => {
    const text = `Weigh yourself every morning and write it down.
Follow a 2 gram low sodium diet.
Cardiac rehab 2 times a week starting in 2 weeks.
Do not be left alone for the first 24 hours.`;
    expect(rules(text).sort()).toEqual(['daily-weight', 'diet', 'supervision', 'therapy'].sort());
  });

  it('reads supplies, time off work and insulin', () => {
    const found = decode(UNINSURED_PAPERS);
    const supplies = found.filter((f) => f.rule === 'supplies').flatMap((f) => f.params.items as string[]);
    expect(supplies).toEqual(['gauze', 'medical tape', 'saline', 'glucose meter', 'test strips', 'lancets']);
    expect(found.find((f) => f.rule === 'no-work')?.label).toBe('Off work until cleared');
    expect(found.find((f) => f.rule === 'prescriptions')?.params.insulin).toBe(true);
    expect(found.find((f) => f.rule === 'supervision')?.params.hours).toBe(24);
  });

  it('returns nothing for empty papers', () => {
    expect(decode('')).toEqual([]);
  });
});
