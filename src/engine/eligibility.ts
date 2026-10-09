import type { Patient } from './types';

// The care-and-coverage screener. It answers "what could this person qualify for?"
// with plain reasons built from their own numbers, and a next step for each.
// Rules are deliberately conservative: "likely" only when published thresholds say so.

/** 2026 HHS poverty guidelines, 48 contiguous states and DC. */
export const FPL_2026 = { base: 15_960, perPerson: 5_680 };

export function fplAnnual(householdSize: number): number {
  return FPL_2026.base + FPL_2026.perPerson * Math.max(0, Math.round(householdSize) - 1);
}

/** Monthly income as a percent of the poverty line, or undefined if income wasn't given. */
export function fplPercent(p: Pick<Patient, 'monthlyIncome' | 'householdSize'>): number | undefined {
  if (p.monthlyIncome === null || p.monthlyIncome === undefined || Number.isNaN(p.monthlyIncome)) return undefined;
  return Math.round(((p.monthlyIncome * 12) / fplAnnual(p.householdSize || 1)) * 100);
}

export type ProgramStatus = 'likely' | 'maybe' | 'unlikely';

export interface Program {
  id: string;
  name: string;
  status: ProgramStatus;
  /** One or two sentences using the person's own situation. */
  why: string;
  next: string;
  contact: { who: string; phone?: string; url?: string };
  script: string;
  /** Timing note, like open enrollment dates. */
  when?: string;
}

export interface Screening {
  fpl?: number;
  uninsured: boolean;
  programs: Program[];
}

const LAWRENCE = ['66044', '66045', '66046', '66047', '66049'];
const inKCK = (zip: string) => zip.startsWith('661');
const inKCMetro = (zip: string) => inKCK(zip) || zip.startsWith('641') || zip.startsWith('662');

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Next HealthCare.gov open enrollment window (Nov 1 to Jan 15). */
export function openEnrollment(now: Date): { open: boolean; start: Date; end: Date; byForJan: Date } {
  const y = now.getFullYear();
  const thisStart = new Date(y, 10, 1);
  const prevEnd = new Date(y, 0, 15, 23, 59);
  if (now <= prevEnd) return { open: true, start: new Date(y - 1, 10, 1), end: prevEnd, byForJan: new Date(y - 1, 11, 15) };
  const end = new Date(y + 1, 0, 15, 23, 59);
  return { open: now >= thisStart, start: thisStart, end, byForJan: new Date(y, 11, 15) };
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function screen(patient: Patient, now = new Date()): Screening {
  const fpl = fplPercent(patient);
  const name = patient.name.split(' ')[0] || 'They';
  const poss = ({ she: 'her', he: 'his', they: 'their' } as const)[patient.pronouns ?? 'they'];
  const uninsured = patient.insurance === 'none';
  const state = patient.state.toUpperCase();
  const working = patient.age < 65;
  const incomeText =
    fpl === undefined
      ? 'Add monthly income in the intake to sharpen this.'
      : `${money((patient.monthlyIncome ?? 0) * 12)} a year for a household of ${patient.householdSize} is about ${fpl}% of the poverty line.`;
  const programs: Program[] = [];

  // 1. The hospital bill. The biggest number, and the one families don't know to ask about.
  programs.push({
    id: 'hospital-fa',
    name: 'Hospital financial assistance (charity care)',
    status: fpl !== undefined && fpl <= 200 ? 'likely' : fpl !== undefined && fpl > 400 ? 'unlikely' : 'maybe',
    why:
      fpl !== undefined && fpl <= 200
        ? `Nonprofit hospitals must have a financial assistance policy, and most give free or discounted care at this income. ${incomeText}`
        : fpl !== undefined && fpl > 400
          ? `At this income most policies won't apply, but some cap bills for large balances. ${incomeText}`
          : `Nonprofit hospitals must have a financial assistance policy. Many cover families up to 200% to 400% of the poverty line. ${incomeText}`,
    next: 'Get the application before discharge. You can still apply after the bill arrives, usually for about 240 days.',
    contact: { who: 'The hospital’s financial counselor or billing office' },
    script: `Hi, I’m helping ${patient.name}, who is being discharged ${uninsured ? 'without insurance' : 'today'}. Can we get the financial assistance application and have ${poss} account screened for charity care and Medicaid before the bill goes out? What proof of income do you need?`,
  });

  // 2. A place for follow-up care.
  const lawrence = LAWRENCE.includes(patient.zip);
  programs.push({
    id: 'fqhc',
    name: lawrence ? 'Heartland Community Health Center' : 'Community health center (sliding fee)',
    status: 'likely',
    why:
      fpl === undefined
        ? 'Federally funded health centers see everyone, insured or not, and can’t turn anyone away for inability to pay. Fees slide down by income.'
        : fpl <= 100
          ? `At ${fpl}% of the poverty line, health centers give a full discount, often just a small nominal fee.`
          : fpl <= 200
            ? `At ${fpl}% of the poverty line, health centers give a sliding discount on every visit.`
            : `Above 200% of the poverty line there’s no sliding discount, but health centers still see everyone and often cost less than other clinics.`,
    next: `Book a primary care visit for this week. Ask about their pharmacy and help signing up for coverage.`,
    contact: lawrence
      ? { who: 'Heartland Community Health Center, 1312 W. 6th St., Lawrence', phone: '785-841-7297' }
      : { who: 'Find the nearest health center', url: 'https://findahealthcenter.hrsa.gov' },
    script: `Hi, I’d like to make a new patient appointment for ${patient.name}, who just got out of the hospital and needs a follow-up visit this week. ${uninsured ? `${name} doesn’t have insurance. ` : ''}What do we bring for the sliding fee, and can someone help with coverage and prescription costs?`,
  });

  if (uninsured && inKCMetro(patient.zip)) {
    programs.push({
      id: 'free-clinic',
      name: 'JayDoc Free Clinic (KU School of Medicine)',
      status: 'maybe',
      why: 'A student-run clinic for uninsured and underinsured people in Greater Kansas City. Good for urgent, non-emergency needs while a regular doctor is set up.',
      next: 'General clinic is Monday and Wednesday evenings at 340 Southwest Blvd, Kansas City, KS. Email to ask about getting seen.',
      contact: { who: 'JayDoc Free Clinic', url: 'mailto:jaydocfreeclinic@kumc.edu' },
      script: `Hi, I’m writing for ${patient.name}, who was just discharged from the hospital and doesn’t have insurance. Could ${name} be seen at an upcoming clinic night, and what should ${name} bring?`,
    });
  }

  // 3. Coverage.
  if (uninsured && working) {
    let status: ProgramStatus = 'maybe';
    let why = '';
    if (state === 'MO') {
      status = fpl === undefined ? 'maybe' : fpl <= 138 ? 'likely' : 'unlikely';
      why =
        fpl === undefined
          ? 'Missouri covers adults 19 to 64 up to 138% of the poverty line.'
          : fpl <= 138
            ? `Missouri covers adults 19 to 64 up to 138% of the poverty line, and ${name} is at about ${fpl}%. Medicaid enrollment is open all year.`
            : `Missouri’s adult limit is 138% of the poverty line; ${name} is at about ${fpl}%.`;
    } else if (state === 'KS') {
      status = patient.parent && fpl !== undefined && fpl <= 33 ? 'likely' : 'unlikely';
      why = patient.parent
        ? `Kansas hasn’t expanded Medicaid. Parents qualify only at very low income, about a third of the poverty line${fpl !== undefined ? `, and ${name} is at about ${fpl}%` : ''}.`
        : `Kansas hasn’t expanded Medicaid, so adults without children at home usually can’t get KanCare at any income unless they’re pregnant, have a disability or are 65+.`;
    } else {
      why = 'Depends on the state. In expansion states, adults usually qualify up to 138% of the poverty line.';
    }
    programs.push({
      id: 'medicaid',
      name: state === 'KS' ? 'KanCare (Kansas Medicaid)' : state === 'MO' ? 'MO HealthNet (Missouri Medicaid)' : 'Medicaid',
      status,
      why,
      next:
        state === 'MO'
          ? 'Apply online at mydss.mo.gov, and ask whether coverage can reach back to the hospital stay. The hospital’s financial counselor can help.'
          : 'Ask the hospital’s financial counselor to screen for Medicaid anyway. Disability and pregnancy have their own rules.',
      contact: state === 'MO' ? { who: 'Missouri Department of Social Services', url: 'https://mydss.mo.gov/healthcare/apply' } : { who: 'KanCare', url: 'https://www.kancare.ks.gov' },
      script: `Hi, I’m helping ${patient.name} apply for Medicaid. ${name} is ${patient.age}, was just in the hospital, and has a household of ${patient.householdSize}${patient.monthlyIncome ? ` with about ${money(patient.monthlyIncome)} a month in income` : ''}. What do we need to apply, and can coverage go back to the hospital stay?`,
    });

    const oe = openEnrollment(now);
    const gap = state === 'KS' && fpl !== undefined && fpl < 100;
    const mcaidInstead = state === 'MO' && fpl !== undefined && fpl <= 138;
    programs.push({
      id: 'marketplace',
      name: 'Marketplace health plan (HealthCare.gov)',
      status: gap || mcaidInstead ? 'unlikely' : fpl === undefined ? 'maybe' : 'likely',
      why: gap
        ? `Below the poverty line in Kansas, there’s no Medicaid and no Marketplace tax credit. This is the coverage gap, so the health center and hospital assistance matter most.`
        : mcaidInstead
          ? 'Medicaid is the better fit at this income.'
          : `At ${fpl !== undefined ? `${fpl}%` : 'or above 100%'} of the poverty line, tax credits usually lower the monthly premium.`,
      next: oe.open
        ? `Open enrollment is on now, through ${fmtDate(oe.end)}.`
        : `Open enrollment starts ${fmtDate(oe.start)}. Enroll by ${fmtDate(oe.byForJan)} for coverage on Jan 1.`,
      when: oe.open ? 'Open now' : `Opens ${fmtDate(oe.start)}`,
      contact: { who: 'HealthCare.gov, or a free local enrollment helper', url: 'https://www.healthcare.gov', phone: '1-800-318-2596' },
      script: `Hi, I’d like help enrolling ${patient.name} in a Marketplace plan. ${name} is ${patient.age}, uninsured, household of ${patient.householdSize}${patient.monthlyIncome ? `, about ${money(patient.monthlyIncome * 12)} a year` : ''}. What tax credit would ${name} get, and when would coverage start?`,
    });
  }

  // 4. Food.
  const snapLimit = Math.round((fplAnnual(patient.householdSize) * 1.3) / 12);
  programs.push({
    id: 'snap',
    name: state === 'KS' ? 'Food assistance (SNAP) from Kansas DCF' : 'Food assistance (SNAP)',
    status: fpl === undefined ? 'maybe' : fpl <= 130 ? 'likely' : fpl <= 165 ? 'maybe' : 'unlikely',
    why:
      fpl === undefined
        ? `The usual gross income limit is ${money(snapLimit)} a month for a household of ${patient.householdSize}.`
        : `The usual gross limit is ${money(snapLimit)} a month for a household of ${patient.householdSize}. ${fpl <= 130 ? 'Income is under it.' : 'Income is a little over it, but'} If ${name} is off work, use this month’s lower income.`,
    next: 'Apply now. People with very little income or cash can get help within 7 days instead of 30.',
    contact:
      state === 'KS'
        ? { who: 'Kansas DCF', phone: '1-888-369-4777', url: 'https://www.dcf.ks.gov' }
        : state === 'MO'
          ? { who: 'Missouri Family Support Division', url: 'https://mydss.mo.gov' }
          : { who: 'Dial 211 for the local SNAP office', phone: '211' },
    script: `Hi, I’m helping ${patient.name} apply for food assistance. ${name} was just discharged from the hospital and can’t work right now. Can ${name} get expedited benefits, and what do we need to bring?`,
  });

  programs.push({
    id: 'pantry',
    name: 'Food pantry',
    status: fpl !== undefined && fpl <= 200 ? 'likely' : 'maybe',
    why: 'Pantries give groceries the same week, with little paperwork. A good bridge while SNAP is processed.',
    next: 'Dial 211 or ask the hospital social worker for a pantry open today or tomorrow near the home ZIP code.',
    contact: { who: 'Dial 211 (United Way)', phone: '211' },
    script: `Hi, I’m looking for a food pantry open today or tomorrow near ZIP ${patient.zip || 'code'}. My family member just got out of the hospital and needs groceries that are easy to make.`,
  });

  // 5. Equipment.
  programs.push({
    id: 'equipment',
    name: state === 'KS' ? 'Kansas Equipment Exchange (free refurbished equipment)' : 'Medical equipment loan closet',
    status: 'maybe',
    why:
      state === 'KS'
        ? 'Run by Assistive Technology for Kansans at KU. Refurbished wheelchairs, hospital beds, shower chairs and more at no cost, depending on what’s been donated.'
        : 'Many churches and nonprofits lend walkers, shower chairs and commodes for free.',
    next: 'Ask what’s available near home before buying anything that’s needed for more than a few days.',
    contact: state === 'KS' ? { who: 'Assistive Technology for Kansans', phone: '620-421-8367', url: 'https://atk.ku.edu' } : { who: 'Dial 211 for a loan closet', phone: '211' },
    script: `Hi, ${patient.name} just came home from the hospital and needs equipment like a walker and a shower chair. ${uninsured ? 'There’s no insurance to cover it. ' : ''}What do you have available near ZIP ${patient.zip || 'code'}, and how do we pick it up?`,
  });

  // 6. Prescriptions.
  programs.push({
    id: 'rx',
    name: 'Prescription costs',
    status: uninsured ? 'likely' : 'maybe',
    why: uninsured
      ? 'Without insurance, the same prescription can cost very different amounts at different pharmacies. Asking first often cuts the price a lot.'
      : 'Copays vary. Asking for the cheapest equivalent is always fair.',
    next: 'Before pickup, ask the pharmacy for the cash price and a cheaper generic. Compare a discount card and the health center pharmacy. For brand-name drugs and insulin, ask about the maker’s patient assistance program.',
    contact: { who: 'The pharmacy on the discharge papers' },
    script: `Hi, new prescriptions were sent for ${patient.name}. ${uninsured ? `${name} doesn’t have insurance. ` : ''}What’s the cash price for each one? Is there a cheaper generic or a discount price you can apply?`,
  });

  return { fpl, uninsured, programs };
}
