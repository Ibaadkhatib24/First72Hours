import { clockRel, dayName, fmtWhen, nextClockRel, parseLocal, relHours, WINDOW_H } from './time';
import type { CaseInput, Finding, LineItem, Need, Reason } from './types';

// Typical Kansas City-area prices used for planning estimates (USD). They are ranges on
// purpose: the product shows estimates, and the call scripts confirm real numbers.
export const RATES = {
  careHour: { low: 30, high: 38 }, // non-medical home care, companion or homemaker
  rideRoundTrip: { low: 30, high: 60 },
  rideOneWay: { low: 15, high: 35 },
  wheelchairRoundTrip: { low: 100, high: 200 },
  wheelchairOneWay: { low: 50, high: 100 },
  meal: { low: 10, high: 14 },
  pharmacyDelivery: { low: 0, high: 10 },
};

const ITEMS: Record<string, LineItem> = {
  walker: { name: 'Walker', low: 60, high: 120, dme: true, hsa: true },
  rollator: { name: 'Rollator walker', low: 80, high: 180, dme: true, hsa: true },
  cane: { name: 'Cane', low: 20, high: 40, dme: true, hsa: true },
  crutches: { name: 'Crutches', low: 25, high: 50, dme: true, hsa: true },
  wheelchair: { name: 'Wheelchair, first month rental', low: 60, high: 150, dme: true, hsa: true },
  'knee scooter': { name: 'Knee scooter, first month rental', low: 40, high: 90, hsa: true },
  'shower chair': { name: 'Shower chair', low: 35, high: 70, supply: true, hsa: true },
  'shower bench': { name: 'Shower bench', low: 35, high: 70, supply: true, hsa: true },
  'tub transfer bench': { name: 'Tub transfer bench', low: 50, high: 100, supply: true, hsa: true },
  'tub bench': { name: 'Tub transfer bench', low: 50, high: 100, supply: true, hsa: true },
  'raised toilet seat': { name: 'Raised toilet seat', low: 30, high: 60, supply: true, hsa: true },
  'toilet riser': { name: 'Raised toilet seat', low: 30, high: 60, supply: true, hsa: true },
  'bedside commode': { name: 'Bedside commode', low: 50, high: 100, dme: true, hsa: true },
  commode: { name: 'Bedside commode', low: 50, high: 100, dme: true, hsa: true },
  'grab bars': { name: 'Grab bars, installed', low: 120, high: 250, supply: true, hsa: true },
  reacher: { name: 'Reacher', low: 10, high: 20, supply: true, hsa: true },
  grabber: { name: 'Reacher', low: 10, high: 20, supply: true, hsa: true },
  'sock aid': { name: 'Sock aid', low: 10, high: 15, supply: true, hsa: true },
  'long-handled sponge': { name: 'Long-handled sponge', low: 8, high: 15, supply: true, hsa: true },
  'long handled sponge': { name: 'Long-handled sponge', low: 8, high: 15, supply: true, hsa: true },
  'long-handled shoehorn': { name: 'Long-handled shoehorn', low: 8, high: 15, supply: true, hsa: true },
  'dressing stick': { name: 'Dressing stick', low: 8, high: 15, supply: true, hsa: true },
  'night lights': { name: 'Plug-in night lights', low: 10, high: 20 },
  scale: { name: 'Bathroom scale', low: 20, high: 35 },
  'hospital bed': { name: 'Hospital bed, first month rental', low: 200, high: 500, dme: true, hsa: true },
  groceries: { name: 'Grocery delivery fee', low: 10, high: 20 },
};

const fromPapers = (f: Finding): Reason => ({ kind: 'papers', findingId: f.id, quote: f.quote });
const fromProfile = (fact: string): Reason => ({ kind: 'profile', fact });

const hoursCost = (h: number) => ({ low: RATES.careHour.low * h, high: RATES.careHour.high * h });

export interface NeedsResult {
  needs: Need[];
  /** Windows of round-the-clock presence. */
  presence: Array<[number, number]>;
}

export function buildNeeds(input: CaseInput, findings: Finding[]): NeedsResult {
  const t0 = parseLocal(input.dischargeAt);
  const plannedH = relHours(t0, parseLocal(input.plannedAt));
  const { patient, crew } = input;
  const name = patient.name.split(' ')[0] || 'them';

  // A task meant for "before discharge" becomes "as soon as possible" if planning starts late.
  const prepStart = Math.min(0, plannedH);
  const fit = (w0: number, w1: number): [number, number] => {
    const a = Math.max(w0, plannedH);
    return [a, Math.max(w1, a + 1)];
  };

  const by = <K extends Finding['rule']>(rule: K) => findings.filter((f) => f.rule === rule);
  const one = <K extends Finding['rule']>(rule: K) => findings.find((f) => f.rule === rule);

  const needs: Need[] = [];
  const presence: Array<[number, number]> = [];
  const device = one('mobility-device');
  const wheelchair = device?.params.device === 'wheelchair';

  // Arrival
  needs.push({
    id: 'arrival',
    category: 'transport',
    title: `Bring ${name} home`,
    detail: wheelchair
      ? 'Wheelchair-accessible ride from the hospital. Bring a pillow for the car and the house keys.'
      : 'Ride from the hospital. A sedan with a high seat is easiest after surgery. Bring a pillow and the house keys.',
    because: [fromProfile(`Discharge is ${fmtWhen(t0, 0)}`)],
    window: fit(-0.5, 0),
    duration: 1,
    where: 'out',
    req: { car: true },
    service: wheelchair ? 'wheelchair-ride' : 'ride',
    serviceCost: wheelchair ? RATES.wheelchairOneWay : RATES.rideOneWay,
    medical: true,
    pin: 'arrival',
  });

  const rx = one('prescriptions');
  if (rx) {
    needs.push({
      id: 'rx',
      category: 'transport',
      title: 'Pick up the new prescriptions on the drive home',
      detail: 'Call the pharmacy first so they are ready. Many pharmacies deliver same day if no one can stop.',
      because: [fromPapers(rx)],
      window: fit(0, 3),
      duration: 0.5,
      where: 'out',
      req: { car: true },
      service: 'pharmacy',
      serviceCost: RATES.pharmacyDelivery,
      pairWith: 'arrival',
    });
  }

  if (device) {
    const key = String(device.params.device);
    needs.push({
      id: 'device',
      category: 'equipment',
      title: `Get the ${key} before leaving the hospital`,
      detail: `Ask the case manager to order the ${key} so it is billed to insurance and fitted before ${name} stands up at home.`,
      because: [fromPapers(device)],
      window: fit(prepStart, 0),
      duration: 0.5,
      where: 'out',
      req: {},
      service: 'equipment',
      items: [ITEMS[key] ?? { name: key, low: 40, high: 120, dme: true, hsa: true }],
      pairWith: 'arrival',
    });
  }

  // One delivery for all the small safety gear.
  const kitItems: LineItem[] = [];
  const kitReasons: Reason[] = [];
  for (const f of [...by('bath-safety'), ...by('adl-aids')]) {
    for (const it of f.params.items as string[]) {
      const item = ITEMS[it.toLowerCase()];
      if (item && !kitItems.some((k) => k.name === item.name)) kitItems.push(item);
    }
    kitReasons.push(fromPapers(f));
  }
  const bending = one('bending');
  if (bending && !kitItems.some((k) => k.name === 'Reacher')) {
    kitItems.push(ITEMS.reacher, ITEMS['sock aid']);
    kitReasons.push(fromPapers(bending));
  }
  const fall = one('fall-risk');
  if (fall) {
    kitItems.push(ITEMS['night lights']);
    kitReasons.push(fromPapers(fall));
  }
  const weight = one('daily-weight');
  if (weight) {
    kitItems.push(ITEMS.scale);
    kitReasons.push(fromPapers(weight));
  }
  if (kitItems.length) {
    needs.push({
      id: 'kit',
      category: 'equipment',
      title: 'Order the home-safety kit for same-day delivery',
      detail: `${kitItems.map((i) => i.name).join(', ')}. Save receipts for HSA/FSA.`,
      because: kitReasons,
      window: fit(prepStart, 2),
      duration: 0.5,
      where: 'remote',
      req: {},
      service: 'equipment',
      items: kitItems,
    });
  }

  const bath = by('bath-safety');
  if (bath.length) {
    const names = kitItems.filter((i) => i.supply && !/reacher|sock|sponge|shoehorn|stick/i.test(i.name)).map((i) => i.name.toLowerCase());
    needs.push({
      id: 'bath-setup',
      category: 'equipment',
      title: 'Set up the bathroom before the first bedtime',
      detail: `Install the ${names.join(' and ')}. Test the height with ${name} sitting, and put a night light on the way to the toilet.`,
      because: bath.map(fromPapers),
      window: fit(0, 7),
      duration: 0.75,
      where: 'home',
      req: {},
      service: 'homemaker',
      serviceCost: hoursCost(1),
    });
  }

  if (fall || device) {
    needs.push({
      id: 'fallproof',
      category: 'household',
      title: `${device ? `${String(device.params.device)[0].toUpperCase()}${String(device.params.device).slice(1)}-proof` : 'Fall-proof'} the house`,
      detail: 'Clear 3-foot paths from bed to bathroom to kitchen, pull up throw rugs, tape down cords, and move daily things to counter height.',
      because: [fall, device].filter(Boolean).map((f) => fromPapers(f!)),
      window: fit(prepStart, 3),
      duration: 1,
      where: 'home',
      req: { lift: true },
      service: 'homemaker',
      serviceCost: hoursCost(2),
    });
  }

  const stairs = one('stairs');
  const bed = one('hospital-bed');
  if (bed) {
    needs.push({
      id: 'bed',
      category: 'equipment',
      title: 'Book the hospital bed delivery',
      detail: 'Ask for delivery before discharge and confirm the supplier takes Medicare assignment.',
      because: [fromPapers(bed)],
      window: fit(prepStart, 2),
      duration: 0.5,
      where: 'remote',
      req: {},
      service: 'equipment',
      items: [ITEMS['hospital bed']],
    });
  }
  if (stairs || bed) {
    needs.push({
      id: 'first-floor',
      category: 'household',
      title: 'Set up a first-floor bedroom',
      detail: 'Move a bed (or make room for the hospital bed) near a bathroom, with a lamp, phone charger and water within reach.',
      because: [stairs, bed].filter(Boolean).map((f) => fromPapers(f!)),
      window: fit(prepStart, 6),
      duration: 1.5,
      where: 'home',
      req: { lift: true },
      service: 'homemaker',
      serviceCost: hoursCost(2),
    });
  }

  const oxygen = one('oxygen');
  if (oxygen) {
    needs.push({
      id: 'oxygen',
      category: 'equipment',
      title: 'Be home for the oxygen delivery',
      detail: 'The supplier walks you through the equipment. Keep it away from flames and stoves, and tape tubing paths so no one trips.',
      because: [fromPapers(oxygen)],
      window: fit(0, 6),
      duration: 1,
      where: 'home',
      req: {},
    });
  }

  // Presence
  const sup = one('supervision');
  if (sup) {
    const hours = Math.min(Number(sup.params.hours) || 24, WINDOW_H);
    presence.push([0, hours]);
    needs.push({
      id: 'presence',
      category: 'relief',
      title: `Keep someone with ${name} for ${hours === WINDOW_H ? 'all 72 hours' : `the first ${hours} hours`}`,
      detail: 'Shifts are built from everyone’s availability. Red hatching on the runway means no one is there yet.',
      because: [fromPapers(sup)],
      window: [0, hours],
      duration: hours,
      where: 'home',
      req: {},
      service: 'companion',
      presence: true,
    });
  } else if (patient.livesAlone) {
    const firstMorning = nextClockRel(t0, 9, 6);
    presence.push([0, firstMorning]);
    needs.push({
      id: 'presence',
      category: 'relief',
      title: `Stay over with ${name} the first night`,
      detail: 'The first night home is when most falls and confusion happen. After that, daily check-ins.',
      because: [fromProfile(`${name} lives alone`)],
      window: [0, firstMorning],
      duration: firstMorning,
      where: 'home',
      req: {},
      service: 'companion',
      presence: true,
    });
    for (let d = 1; d < 4; d++) {
      const am = clockRel(t0, d, 9);
      if (am > 0 && am < WINDOW_H && am > firstMorning) {
        needs.push({
          id: `checkin-${d}`,
          category: 'relief',
          title: `Morning check-in visit, ${dayName(t0, d)}`,
          detail: 'Bring in the mail, check the fridge, make sure the walker path is clear.',
          because: [fromProfile(`${name} lives alone`)],
          window: [am - 1, am + 2],
          duration: 0.75,
          where: 'home',
          req: {},
          service: 'companion',
          serviceCost: hoursCost(1),
        });
      }
    }
  }

  // Appointments
  const followUps = by('follow-up');
  followUps.forEach((f, i) => {
    const doctor = String(f.params.doctor);
    let appt: number | undefined;
    if (typeof f.params.dayOffset === 'number') appt = clockRel(t0, f.params.dayOffset, Number(f.params.hour));
    else if (typeof f.params.weekday === 'number') {
      for (let d = 0; d < 7; d++) {
        const r = clockRel(t0, d, Number(f.params.hour));
        const day = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + d).getDay();
        if (day === f.params.weekday && r > 2) {
          appt = r;
          break;
        }
      }
    }
    if (appt !== undefined && appt <= WINDOW_H) {
      needs.push({
        id: `fu-confirm-${i}`,
        category: 'appointments',
        title: `Confirm the time with ${doctor}'s office`,
        detail: 'Ask for the exact time, the address and parking, and whether to bring the walker and a medication list.',
        because: [fromPapers(f)],
        window: fit(prepStart, Math.max(appt - 20, 6)),
        duration: 0.25,
        where: 'remote',
        req: {},
      });
      needs.push({
        id: `fu-ride-${i}`,
        category: 'transport',
        title: `Drive ${name} to ${doctor} and stay for the visit`,
        detail: 'Plan for about 3 hours door to door. Bring the discharge papers and a list of questions.',
        because: [fromPapers(f), ...by('no-driving').map(fromPapers)],
        window: [appt - 1, appt - 0.5],
        duration: 3,
        where: 'out',
        req: { car: true },
        service: wheelchair ? 'wheelchair-ride' : 'ride',
        serviceCost: wheelchair ? RATES.wheelchairRoundTrip : RATES.rideRoundTrip,
        medical: true,
        pin: 'appointment',
        times: [appt],
      });
    } else {
      needs.push({
        id: `fu-book-${i}`,
        category: 'appointments',
        title: `Book the follow-up with ${doctor}${f.params.beyondPhrase ? ` (due within ${f.params.beyondPhrase})` : ''}`,
        detail: 'Book it now and book the ride at the same time. Ride benefits need days of notice.',
        because: [fromPapers(f)],
        window: fit(0, 48),
        duration: 0.25,
        where: 'remote',
        req: {},
        beyond: true,
      });
    }
  });

  const therapy = one('therapy');
  const noDrive = one('no-driving');
  if (therapy) {
    const per = Number(therapy.params.perWeek) || 2;
    needs.push({
      id: 'therapy-book',
      category: 'appointments',
      title: `Schedule ${String(therapy.params.kind)}`,
      detail: `${per} visits a week. Ask for times that fit when someone can drive, and for a location close to home.`,
      because: [fromPapers(therapy)],
      window: fit(0, 48),
      duration: 0.5,
      where: 'remote',
      req: {},
    });
    needs.push({
      id: 'therapy-rides',
      category: 'transport',
      title: `Line up rides to ${String(therapy.params.kind)} for the coming weeks`,
      detail: 'Book recurring rides now. Insurance and Medicaid rides usually need several days of notice.',
      because: [fromPapers(therapy), ...(noDrive ? [fromPapers(noDrive)] : [])],
      window: fit(0, 60),
      duration: 0.5,
      where: 'remote',
      req: {},
      service: 'ride',
      serviceCost: { low: RATES.rideRoundTrip.low * per, high: RATES.rideRoundTrip.high * per },
      costUnit: 'a week',
      medical: true,
      beyond: true,
      times: [Math.min(Number(therapy.params.startsWithinH) || 168, 168)],
    });
  } else if (noDrive) {
    needs.push({
      id: 'rides-later',
      category: 'transport',
      title: `Line up rides for the ${noDrive.params.hours ? 'weeks' : 'time'} ${name} can't drive`,
      detail: 'Make a simple ride rota for groceries, church and appointments so no one has to ask each time.',
      because: [fromPapers(noDrive)],
      window: fit(0, 60),
      duration: 0.5,
      where: 'remote',
      req: {},
      beyond: true,
    });
  }

  const hh = one('home-health');
  if (hh) {
    const within = Math.min(Number(hh.params.withinH) || 48, WINDOW_H);
    needs.push({
      id: 'hh-confirm',
      category: 'appointments',
      title: 'Confirm when the home health nurse is coming',
      detail: 'Call the agency on the discharge papers. Ask for a time window and give them the best number to call.',
      because: [fromPapers(hh)],
      window: fit(0, Math.max(within / 2, 6)),
      duration: 0.25,
      where: 'remote',
      req: {},
    });
    needs.push({
      id: 'hh-visit',
      category: 'appointments',
      title: 'Be home to let the nurse in',
      detail: 'Have the discharge papers, medication bottles and the walker ready.',
      because: [fromPapers(hh)],
      window: [Math.max(12, within - 24), within],
      duration: 1,
      where: 'home',
      req: {},
      pin: 'visit',
    });
  }

  // Meals, grouped per day
  const diet = one('diet');
  const dietTags = (diet?.params.tags as string[] | undefined) ?? [];
  const dietLabel = dietTags.length ? `${dietTags.map((t) => t.replace(/-/g, ' ')).join(', ')} ` : '';
  const MEALS = [
    { name: 'breakfast', hour: 8 },
    { name: 'lunch', hour: 12 },
    { name: 'dinner', hour: 17.5 },
  ];
  for (let d = 0; d < 4; d++) {
    const times = MEALS.map((m) => ({ ...m, at: clockRel(t0, d, m.hour) })).filter((m) => m.at >= 0.5 && m.at <= WINDOW_H);
    if (!times.length) continue;
    const list = times.map((m) => m.name);
    const listText = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
    const why: Reason[] = [];
    if (diet) why.push(fromPapers(diet));
    if (patient.livesAlone) why.push(fromProfile(`${name} lives alone`));
    const lift = one('lift-limit');
    if (lift && !why.length) why.push(fromPapers(lift));
    if (!why.length) why.push(fromProfile(`${name} is recovering and shouldn't cook yet`));
    needs.push({
      id: `meals-${d}`,
      category: 'meals',
      title: `${dietLabel ? dietLabel[0].toUpperCase() + dietLabel.slice(1) : ''}${dietLabel ? 'meals' : 'Meals'}, ${dayName(t0, d)} ${listText}`,
      short: `${dayName(t0, d)} meals`,
      detail: `${times.length} meal${times.length > 1 ? 's' : ''} ready to heat.${dietTags.length ? ` Check labels: ${dietTags.join(', ').replace(/-/g, ' ')}.` : ''}`,
      because: why,
      window: [times[0].at - 1, times[times.length - 1].at],
      duration: 0.5 * times.length,
      where: 'home',
      req: {},
      service: 'meals',
      serviceCost: { low: RATES.meal.low * times.length, high: RATES.meal.high * times.length },
      preferBenefit: true,
      pin: 'meal',
      times: times.map((m) => m.at),
    });
  }

  const lift = one('lift-limit');
  if (lift || noDrive || patient.livesAlone) {
    needs.push({
      id: 'groceries',
      category: 'meals',
      title: `Stock the kitchen${dietLabel ? ` (${dietLabel.trim()})` : ''}`,
      detail: 'Order delivery to arrive before dinner on day one: easy breakfasts, fruit, drinks, and things that open without lifting.',
      because: [lift, noDrive].filter(Boolean).map((f) => fromPapers(f!)).concat(patient.livesAlone ? [fromProfile(`${name} lives alone`)] : []),
      window: fit(prepStart, 3),
      duration: 0.5,
      where: 'remote',
      req: {},
      items: [ITEMS.groceries],
    });
  }

  const chores = one('no-housework');
  if (lift || chores || bending) {
    needs.push({
      id: 'household',
      category: 'household',
      title: 'Laundry, trash and dishes',
      detail: `${name} can't carry baskets or bags yet. Leave the trash and recycling ready for pickup day.`,
      because: [lift, chores, bending].filter(Boolean).map((f) => fromPapers(f!)),
      window: [20, 60],
      duration: 2,
      where: 'home',
      req: { lift: true },
      service: 'homemaker',
      serviceCost: hoursCost(2.5),
    });
  }

  // Coordination
  needs.push({
    id: 'group-text',
    category: 'coordination',
    title: 'Start the family group text and share this plan',
    detail: 'One thread, one plan. Everyone sees their own tasks from the shared link.',
    because: [fromProfile(`${crew.length} ${crew.length === 1 ? 'person is' : 'people are'} helping`)],
    window: fit(prepStart, 2),
    duration: 0.25,
    where: 'remote',
    req: {},
  });
  needs.push({
    id: 'fridge',
    category: 'coordination',
    title: `Post the fridge sheet at ${name}'s`,
    detail: 'Who is coming when, today’s tasks and the numbers to call. For anyone who is not on the group text.',
    because: [fromProfile('Not everyone checks their phone')],
    window: fit(0, 8),
    duration: 0.1,
    where: 'home',
    req: {},
  });

  return { needs, presence };
}
