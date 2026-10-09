import { fmtWhen } from './time';
import type { CrewMember, Eligibility, LineItem, Need, Patient, ServiceKey, SourceKind } from './types';

// "Who pays" knows two things most benefit lists ignore:
//   1. who is eligible, and
//   2. how long each source takes to start.
// A benefit that starts on Hour 96 is no help for a ride on Hour 44, so the engine
// checks every source against the clock before it counts the money.

export interface Ctx {
  patient: Patient;
  crew: CrewMember[];
  /** Hours from discharge to when planning started (negative = planning before discharge). */
  plannedH: number;
  t0: Date;
  /** Walker, cane, wheelchair... from the papers, so scripts can mention it. */
  device?: string;
}

export interface Source {
  id: string;
  name: (c: Ctx) => string;
  kind: SourceKind;
  services?: ServiceKey[];
  items?: (it: LineItem) => boolean;
  medicalOnly?: boolean;
  eligible: (c: Ctx) => Eligibility;
  coverPct: number;
  /** Relative hour when this source can first deliver. */
  readyAt: (c: Ctx) => number;
  contact: (c: Ctx) => { who: string; phone?: string };
  script: (c: Ctx, need: Need, at: number) => string;
  bring: string[];
  caveat: string;
}

const first = (c: Ctx) => c.patient.name.split(' ')[0] || 'the patient';
const poss = (c: Ctx) => ({ she: 'her', he: 'his', they: 'their' })[c.patient.pronouns ?? 'they'];
const uses = (c: Ctx) => (c.device ? ` ${first(c)} uses a ${c.device}.` : '');
const isMA = (c: Ctx) => c.patient.insurance === 'medicare-advantage';
const hasMedicare = (c: Ctx) => ['medicare', 'medicare-advantage', 'dual'].includes(c.patient.insurance);
const hasMedicaid = (c: Ctx) => ['medicaid', 'dual'].includes(c.patient.insurance);
const isVet = (c: Ctx) => c.patient.veteran || c.patient.insurance === 'va';
const kansas = (c: Ctx) => c.patient.state.toUpperCase() === 'KS';
const agingLine = (c: Ctx) =>
  kansas(c)
    ? { who: 'Kansas Aging & Disability Resource Center', phone: '855-200-2372' }
    : { who: 'Eldercare Locator (finds the local Area Agency on Aging)', phone: '1-800-677-1116' };
const memberServices = { who: 'Member services, the number on the back of the plan card' };
const backupMember = (c: Ctx) => c.crew.find((m) => m.backupCare);
const itemNames = (need: Need, f: (it: LineItem) => boolean) =>
  (need.items ?? []).filter(f).map((i) => i.name.toLowerCase()).join(', ');

export const SOURCES: Source[] = [
  // Insurance
  {
    id: 'medicare-dme',
    name: (c) => (isMA(c) ? 'Medicare Advantage equipment coverage' : 'Medicare Part B equipment coverage'),
    kind: 'insurance',
    items: (it) => !!it.dme,
    eligible: (c) => (hasMedicare(c) ? 'yes' : 'no'),
    coverPct: 0.8,
    readyAt: (c) => (c.plannedH < 0 ? c.plannedH + 2 : c.plannedH + 24),
    contact: (c) =>
      c.plannedH < 0
        ? { who: 'The hospital case manager (before discharge)' }
        : { who: 'A Medicare-enrolled equipment supplier, or 1-800-MEDICARE', phone: '1-800-633-4227' },
    script: (c, need) =>
      `Hi, I'm helping ${c.patient.name} get ready to go home. The discharge papers say ${first(c)} needs a ${itemNames(need, (i) => !!i.dme)}. ` +
      `Can you order it so it's billed to ${poss(c)} ${isMA(c) ? 'Medicare Advantage plan' : 'Medicare'}? ` +
      `Is the supplier enrolled in Medicare and do they accept assignment? When can it be here?`,
    bring: ['The discharge papers (they count as the doctor’s order)', 'Medicare or plan card'],
    caveat:
      'Medicare pays 80% after the Part B deductible ($283 in 2026), only through suppliers that are enrolled and accept assignment. It usually does not pay for shower chairs, grab bars or raised toilet seats. Medicare Advantage covers the same equipment, sometimes with a different copay.',
  },
  {
    id: 'private-dme',
    name: () => 'Health plan equipment benefit',
    kind: 'insurance',
    items: (it) => !!it.dme,
    eligible: (c) => (c.patient.insurance === 'private' ? 'likely' : 'no'),
    coverPct: 0.7,
    readyAt: (c) => c.plannedH + 24,
    contact: () => memberServices,
    script: (c, need) =>
      `Hi, I'm calling for ${c.patient.name}. ${first(c)}'s doctor ordered a ${itemNames(need, (i) => !!i.dme)} at discharge. Is it covered, which suppliers are in network, and what will ${first(c)} owe?`,
    bring: ['Insurance card', 'The discharge papers'],
    caveat: 'Coverage and coinsurance vary by plan. In-network suppliers cost less.',
  },
  {
    id: 'ma-otc',
    name: () => 'Medicare Advantage OTC or bathroom-safety allowance',
    kind: 'insurance',
    items: (it) => !!it.supply,
    eligible: (c) => (isMA(c) ? 'maybe' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 24,
    contact: () => memberServices,
    script: (c, need) =>
      `Does ${c.patient.name}'s plan have an over-the-counter allowance or a bathroom-safety benefit? Would it cover a ${itemNames(need, (i) => !!i.supply)}? How do I order, and how fast does it ship?`,
    bring: ['Plan card'],
    caveat: 'Some Medicare Advantage plans include an OTC allowance or bathroom-safety items. Many don’t, so ask before you buy.',
  },
  {
    id: 'ma-meals',
    name: () => 'Medicare Advantage post-discharge meals',
    kind: 'insurance',
    services: ['meals'],
    eligible: (c) => (isMA(c) ? 'likely' : c.patient.insurance === 'dual' ? 'maybe' : 'no'),
    coverPct: 1,
    readyAt: (c) => Math.max(c.plannedH + 48, 0),
    contact: () => memberServices,
    script: (c, need) =>
      `Hi, I'm calling for ${c.patient.name}, a member. ${first(c)} is being discharged from an inpatient hospital stay ${fmtWhen(c.t0, 0)}. ` +
      `I'd like to start ${poss(c)} post-discharge meal benefit.${/sodium|heart|diabetic|soft/i.test(need.title) ? ` ${first(c)} needs ${need.title.split(' meals')[0].toLowerCase()} meals.` : ''} ` +
      `How many meals are covered, when does the first delivery come, and do you need anything from the hospital?`,
    bring: ['Plan card and member ID', 'Discharge date', 'Diet from the discharge papers'],
    caveat:
      'Not every plan has it. A typical benefit is about 14 meals over a week after an inpatient stay. Deliveries usually start about 2 days after you ask, so call before discharge.',
  },
  {
    id: 'ma-rides',
    name: () => 'Medicare Advantage ride benefit',
    kind: 'insurance',
    services: ['ride', 'wheelchair-ride'],
    medicalOnly: true,
    eligible: (c) => (isMA(c) ? 'maybe' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 48,
    contact: () => memberServices,
    script: (c, need, at) =>
      `Hi, I'm calling for ${c.patient.name}. Does ${poss(c)} plan include rides to medical appointments? I need a ride ${fmtWhen(c.t0, at)} for a visit with ${need.title.replace(/^Drive \w+ to /, '').replace(/ and stay.*/, '')}.${uses(c)} How much notice do you need?`,
    bring: ['Plan card', 'Appointment address and time'],
    caveat: 'Many Medicare Advantage plans include a set number of rides to medical visits each year. Most need about 2 business days’ notice.',
  },
  {
    id: 'ma-inhome',
    name: () => 'Medicare Advantage in-home support hours',
    kind: 'insurance',
    services: ['companion', 'homemaker'],
    eligible: (c) => (isMA(c) ? 'maybe' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 72,
    contact: () => memberServices,
    script: (c) =>
      `Hi, I'm calling for ${c.patient.name}, who just had an inpatient stay. Does ${poss(c)} plan include in-home support or companion hours after discharge? How many, and how fast can someone start?`,
    bring: ['Plan card', 'Discharge date'],
    caveat: 'Some Medicare Advantage plans include in-home support hours after a hospital stay. Not all do, and setup can take a few days.',
  },
  {
    id: 'medicaid-nemt',
    name: (c) => (kansas(c) ? 'KanCare ride benefit (NEMT)' : 'Medicaid ride benefit (NEMT)'),
    kind: 'insurance',
    services: ['ride', 'wheelchair-ride'],
    medicalOnly: true,
    eligible: (c) => (hasMedicaid(c) ? 'yes' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 72,
    contact: (c) => ({ who: kansas(c) ? 'Your KanCare plan’s member services (number on the card)' : 'Your Medicaid plan’s ride line' }),
    script: (c, _need, at) =>
      `Hi, I need to schedule a non-emergency medical ride for ${c.patient.name} on ${fmtWhen(c.t0, at)}. ${first(c)} was just discharged from the hospital.${uses(c)} Do you offer urgent rides if it's less than 3 days away?`,
    bring: ['Medicaid ID', 'Appointment address and time', 'Mobility needs (walker or wheelchair)'],
    caveat: 'Medicaid covers rides to medical appointments. Most plans want about 3 business days’ notice, so ask about urgent rides after a discharge.',
  },
  // Programs
  {
    id: 'aaa-meals',
    name: () => 'Home-delivered meals for adults 60+ (Older Americans Act)',
    kind: 'program',
    services: ['meals'],
    eligible: (c) => (c.patient.age >= 60 ? 'likely' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 120,
    contact: agingLine,
    script: (c) =>
      `Hi, ${c.patient.name} is ${c.patient.age} and just came home from the hospital, and can't cook or drive for a while. Can we start home-delivered meals, and how soon could they begin?`,
    bring: ['Address and phone', 'Diet from the discharge papers'],
    caveat:
      'Local Area Agencies on Aging run these meals. They ask for a donation but don’t charge. There’s an intake call and sometimes a waitlist, so call now for next week.',
  },
  {
    id: 'aaa-respite',
    name: () => 'Family Caregiver Support Program respite',
    kind: 'program',
    services: ['companion'],
    eligible: (c) => (c.patient.age >= 60 ? 'maybe' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 168,
    contact: agingLine,
    script: (c) =>
      `Hi, I'm the family caregiver for ${c.patient.name}, who is ${c.patient.age} and just home from the hospital. I'd like to ask about respite through the Family Caregiver Support Program. What's the process?`,
    bring: ['Patient’s age and address', 'Your hours and what breaks you need'],
    caveat: 'Funded by the National Family Caregiver Support Program through local Area Agencies on Aging. Budgets are limited and it takes time to start.',
  },
  {
    id: 'va-respite',
    name: () => 'VA respite care',
    kind: 'program',
    services: ['companion', 'homemaker'],
    eligible: (c) => (isVet(c) ? 'likely' : 'no'),
    coverPct: 1,
    readyAt: (c) => c.plannedH + 168,
    contact: () => ({ who: 'VA Caregiver Support Line', phone: '855-260-3274' }),
    script: (c) =>
      `Hi, I care for ${c.patient.name}, a veteran who was just discharged from the hospital. I'd like to start a referral for respite care and talk to a Caregiver Support Coordinator.`,
    bring: ['Veteran’s full name and date of birth', 'VA facility they use'],
    caveat: 'Eligible veterans can usually get up to 30 days of respite a year. It won’t be ready this week, so start the referral now.',
  },
  {
    id: 'employer-backup',
    name: (c) => `Backup care through ${backupMember(c)?.name ?? 'a helper'}’s job`,
    kind: 'employer',
    services: ['companion', 'homemaker'],
    eligible: (c) => (backupMember(c) ? 'likely' : 'no'),
    coverPct: 0.8,
    readyAt: (c) => c.plannedH + 24,
    contact: (c) => ({ who: `${backupMember(c)?.name ?? 'Your'}’s HR benefits portal` }),
    script: (c, _need, at) =>
      `I'd like to book backup adult care for my family member ${c.patient.name} starting ${fmtWhen(c.t0, at)}. ${first(c)} is just home from the hospital and needs someone there.${uses(c)} How many days do I have left this year and what's the hourly copay?`,
    bring: ['Employee ID', 'Address, times and care needs'],
    caveat: 'Many employers subsidize a few backup care days a year. Expect a small hourly copay and about a day’s notice.',
  },
  // Community
  {
    id: 'meal-train',
    name: () => 'Meal train from friends, neighbors or a faith community',
    kind: 'community',
    services: ['meals'],
    eligible: () => 'maybe',
    coverPct: 1,
    readyAt: (c) => c.plannedH + 12,
    contact: () => ({ who: 'Friends, neighbors, a church or community group' }),
    script: (c, need) =>
      `Hi! ${first(c)} is home from the hospital and can't cook for a few days. Could you bring ${need.title.toLowerCase().includes('dinner') ? 'a dinner' : 'a meal'} for ${need.title.split(', ').slice(-1)[0]}? I'll send the address and drop-off time.`,
    bring: ['Address and drop-off time', 'Diet from the discharge papers'],
    caveat: 'Free, and it lifts the load. It depends on people saying yes, so the plan doesn’t count on it.',
  },
  {
    id: '211',
    name: () => '211 volunteer rides and chore help',
    kind: 'community',
    services: ['ride', 'homemaker'],
    eligible: () => 'maybe',
    coverPct: 1,
    readyAt: (c) => c.plannedH + 72,
    contact: () => ({ who: 'Dial 211 (United Way)', phone: '211' }),
    script: (c) => `Hi, I'm looking for volunteer rides or chore help for ${c.patient.name}, who was just discharged from the hospital and can't drive. What's available near ZIP ${c.patient.zip}?`,
    bring: ['ZIP code', 'Dates and times needed'],
    caveat: 'Volunteer programs vary by county and usually need advance notice.',
  },
  // Paying directly
  {
    id: 'rideshare',
    name: () => 'Rideshare or taxi',
    kind: 'private',
    services: ['ride'],
    eligible: () => 'yes',
    coverPct: 0,
    readyAt: (c) => c.plannedH + 0.5,
    contact: () => ({ who: 'A rideshare app or local cab' }),
    script: (c) => `Book a larger car${c.device ? ` so the ${c.device} fits` : ''}, and schedule it ahead in the app.`,
    bring: ['Pillow for the seat', 'Discharge papers'],
    caveat: 'Works if the patient can get in and out of a car with help.',
  },
  {
    id: 'wheelchair-van',
    name: () => 'Wheelchair van service',
    kind: 'private',
    services: ['wheelchair-ride'],
    eligible: () => 'yes',
    coverPct: 0,
    readyAt: (c) => c.plannedH + 24,
    contact: () => ({ who: 'A local wheelchair transport company' }),
    script: (c, _n, at) => `I need a wheelchair-accessible ride for ${c.patient.name} on ${fmtWhen(c.t0, at)}, with a wait-and-return. What's the price?`,
    bring: ['Pickup and drop-off addresses', 'Wheelchair size'],
    caveat: 'Usually needs a day’s notice.',
  },
  {
    id: 'agency',
    name: () => 'Licensed home care agency',
    kind: 'private',
    services: ['companion', 'homemaker'],
    eligible: () => 'yes',
    coverPct: 0,
    readyAt: (c) => c.plannedH + 24,
    contact: () => ({ who: 'A licensed home care agency (see Trusted help)' }),
    script: (c, _n, at) =>
      `I need a companion for ${c.patient.name} starting ${fmtWhen(c.t0, at)}. ${first(c)} is just home from a hospital stay.${uses(c)} What's your hourly rate and minimum, and are your caregivers background-checked?`,
    bring: ['Address and hours', 'What help is needed (no medical care)'],
    caveat: 'Most agencies have a 4-hour minimum and need about a day’s notice.',
  },
  {
    id: 'meal-delivery',
    name: () => 'Meal delivery',
    kind: 'private',
    services: ['meals'],
    eligible: () => 'yes',
    coverPct: 0,
    readyAt: (c) => c.plannedH + 1,
    contact: () => ({ who: 'A meal delivery app or a local restaurant' }),
    script: () => 'Order ready-to-heat meals and check the sodium on the label.',
    bring: ['Diet from the discharge papers'],
    caveat: 'Fast, but the most expensive way to cover meals.',
  },
  {
    id: 'pharmacy-delivery',
    name: () => 'Pharmacy delivery',
    kind: 'private',
    services: ['pharmacy'],
    eligible: () => 'yes',
    coverPct: 0,
    readyAt: (c) => c.plannedH + 3,
    contact: () => ({ who: 'The pharmacy on the discharge papers' }),
    script: (c) => `Hi, new prescriptions were sent for ${c.patient.name} today. Can you deliver them this afternoon?`,
    bring: ['Patient’s date of birth', 'Insurance card'],
    caveat: 'Many pharmacies deliver same day for free or a small fee.',
  },
  {
    id: 'retail',
    name: () => 'Pharmacy or same-day online order',
    kind: 'private',
    services: ['equipment'],
    eligible: () => 'yes',
    coverPct: 0,
    readyAt: (c) => c.plannedH + 3,
    contact: () => ({ who: 'A pharmacy or medical supply store' }),
    script: () => 'Ask for same-day pickup or delivery, and keep the receipt for HSA/FSA.',
    bring: ['HSA/FSA card if you have one'],
    caveat: 'You pay up front.',
  },
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id)!;

export interface Range {
  low: number;
  high: number;
}

export interface Layer {
  sourceId: string;
  name: string;
  kind: SourceKind;
  eligibility: Eligibility;
  low: number;
  high: number;
}

export interface SourceOption {
  sourceId: string;
  name: string;
  kind: SourceKind;
  eligibility: Eligibility;
  readyAt: number;
  /** Can it start before the help is needed? */
  inTime: boolean;
}

export interface Funding {
  cost: Range;
  layers: Layer[];
  youPay: Range;
  hsa: boolean;
  options: SourceOption[];
  /** For service needs: who would actually do it. */
  provider?: SourceOption;
  /** Nothing can start in time. */
  unfillable?: boolean;
}

const counts = (e: Eligibility) => e === 'yes' || e === 'likely';
const zero = (): Range => ({ low: 0, high: 0 });

function option(s: Source, c: Ctx, at: number): SourceOption {
  const readyAt = s.readyAt(c);
  return { sourceId: s.id, name: s.name(c), kind: s.kind, eligibility: s.eligible(c), readyAt, inTime: readyAt <= at + 1e-9 };
}

/** Money for things that have to be bought no matter who does the task. */
export function fundItems(need: Need, c: Ctx, at: number): Funding {
  const items = need.items ?? [];
  const cost = items.reduce((r, i) => ({ low: r.low + i.low, high: r.high + i.high }), zero());
  const covered = new Set<number>();
  const layers: Layer[] = [];
  const options: SourceOption[] = [];
  for (const s of SOURCES) {
    if (!s.items) continue;
    const idx = items.map((it, i) => (s.items!(it) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const o = option(s, c, at);
    if (o.eligibility === 'no') continue;
    options.push(o);
    if (!o.inTime || !counts(o.eligibility)) continue;
    const fresh = idx.filter((i) => !covered.has(i));
    if (!fresh.length) continue;
    const low = fresh.reduce((sum, i) => sum + items[i].low * s.coverPct, 0);
    const high = fresh.reduce((sum, i) => sum + items[i].high * s.coverPct, 0);
    fresh.forEach((i) => covered.add(i));
    layers.push({ sourceId: s.id, name: o.name, kind: s.kind, eligibility: o.eligibility, low, high });
  }
  const paid = layers.reduce((r, l) => ({ low: r.low + l.low, high: r.high + l.high }), zero());
  const retail = SOURCES.find((s) => s.id === 'retail')!;
  options.push(option(retail, c, at));
  return {
    cost,
    layers,
    youPay: { low: Math.max(0, cost.low - paid.low), high: Math.max(0, cost.high - paid.high) },
    hsa: c.patient.hasHsaFsa && items.some((i) => i.hsa),
    options,
  };
}

/** Money and a provider for a service when no family member can do it. */
export function fundService(service: ServiceKey, cost: Range, c: Ctx, at: number, medical = false): Funding {
  const layers: Layer[] = [];
  const options: SourceOption[] = [];
  let provider: SourceOption | undefined;
  let remaining = 1;
  for (const s of SOURCES) {
    if (!s.services?.includes(service)) continue;
    if (s.medicalOnly && !medical) continue;
    const o = option(s, c, at);
    if (o.eligibility === 'no') continue;
    options.push(o);
    if (!o.inTime) continue;
    if (s.kind === 'private') {
      provider ??= o;
      continue;
    }
    if (!counts(o.eligibility) || remaining <= 0) continue;
    provider ??= o;
    const share = remaining * s.coverPct;
    remaining -= share;
    layers.push({ sourceId: s.id, name: o.name, kind: s.kind, eligibility: o.eligibility, low: cost.low * share, high: cost.high * share });
  }
  return {
    cost,
    layers,
    youPay: { low: cost.low * remaining, high: cost.high * remaining },
    hsa: c.patient.hasHsaFsa && medical,
    options,
    provider,
    unfillable: !provider,
  };
}
