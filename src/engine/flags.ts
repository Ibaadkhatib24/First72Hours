import type { Plan } from './planner';
import type { Status } from './share';
import { fmtRange, fmtWhen } from './time';
import type { Need } from './types';

// Heads up: the things most likely to go wrong in the first 72 hours, worked out from the
// plan itself. Each flag says what could happen, why we think so, what to do, and where to
// fix it. A flag clears itself when the task behind it is marked done.

export type FlagLevel = 'now' | 'soon' | 'watch';
export type TabId = 'home' | 'alerts' | 'schedule' | 'todo' | 'money' | 'coverage' | 'helpers' | 'hire' | 'later';

export interface Flag {
  id: string;
  level: FlagLevel;
  title: string;
  why: string;
  /** A line from the discharge papers backing it up. */
  quote?: string;
  action: string;
  tab: TabId;
  /** Tasks that clear this flag when done. */
  needIds: string[];
  resolved: boolean;
}

export interface HeadsUp {
  flags: Flag[];
  /** "When to get help" lines from the papers, word for word. */
  warnings: string[];
  open: number;
}

const ORDER: Record<FlagLevel, number> = { now: 0, soon: 1, watch: 2 };

export function headsUp(plan: Plan, status: Record<string, Status>, nowH: number): HeadsUp {
  const { t0, ctx } = plan;
  const name = ctx.patient.name.split(' ')[0] || 'They';
  const done = (id: string) => status[id] === 'done';
  const need = (id: string) => plan.needs.find((n) => n.id === id);
  const finding = (rule: string) => plan.findings.find((f) => f.rule === rule);
  const quoteOf = (n?: Need) => n?.because.find((b) => b.kind === 'papers')?.quote ?? undefined;
  const flags: Flag[] = [];
  const add = (f: Omit<Flag, 'resolved'> & { resolved?: boolean }) =>
    flags.push({ ...f, resolved: f.resolved ?? (f.needIds.length > 0 && f.needIds.every(done)) });

  // Nobody there
  const presence = plan.needs.find((n) => n.presence);
  for (const g of plan.gaps) {
    const provider = g.funding.provider;
    const booked = done(g.id) || (provider ? done(`call:${provider.sourceId}`) : false);
    add({
      id: `gap-${g.id}`,
      level: g.start < 24 ? 'now' : 'soon',
      title: `Nobody is with ${name} ${fmtRange(t0, g.start, g.end)}`,
      why: presence?.because[0]?.kind === 'papers' ? 'The papers say someone has to be there.' : `${name} shouldn’t be alone yet.`,
      quote: quoteOf(presence),
      action: provider ? `Ask family or a friend first. If no one can, the backup is: ${provider.name}.` : 'Ask a friend, neighbor or church member. Paid help can’t start this fast.',
      tab: 'schedule',
      needIds: [],
      resolved: booked,
    });
  }

  // Tasks with no one assigned
  for (const id of plan.unowned) {
    const n = need(id);
    if (!n) continue;
    add({ id: `owner-${id}`, level: 'now', title: `No one is set to do this: ${n.title.toLowerCase()}`, why: 'Nobody on the list can do it at that time, and no service can start in time.', action: 'Ask someone to take it, or change the helpers’ times.', tab: 'todo', needIds: [id] });
  }

  // Ask the hospital before leaving
  if (need('ask-hospital') && plan.plannedH < 0) {
    add({
      id: 'ask-hospital',
      level: 'now',
      title: `Talk to the case manager before ${name} leaves`,
      why: 'Rides, equipment, starter medicines and the financial help form are easiest to get before discharge.',
      action: 'Use the script in the to-do list.',
      tab: 'todo',
      needIds: ['ask-hospital'],
    });
  }

  // Medicines
  const rx = need('rx');
  if (rx) {
    const uninsured = ctx.patient.insurance === 'none';
    add({
      id: 'medicines',
      level: 'now',
      title: uninsured ? 'New medicines need to be picked up today, and cost could get in the way' : 'New medicines need to be picked up today',
      why: 'Medicine problems are one of the most common things that go wrong after a hospital stay.',
      quote: quoteOf(rx),
      action: uninsured ? 'Get the cash price first, then pick them up on the way home.' : 'Pick them up on the way home.',
      tab: 'todo',
      needIds: need('rx-price') ? ['rx-price', 'rx'] : ['rx'],
    });
  }

  // Falls
  const fallIds = ['fallproof', 'bath-setup', 'first-floor'].filter((id) => need(id));
  if (fallIds.length) {
    const f = finding('fall-risk') ?? finding('mobility-device') ?? finding('bath-safety');
    add({
      id: 'falls',
      level: 'now',
      title: 'Falls are a big risk the first nights home',
      why: 'The risk of a fall stays high after a hospital stay, and the first trips to the bathroom at night are the hardest.',
      quote: f?.quote,
      action: 'Clear the paths, add night lights and set up the bathroom before bedtime.',
      tab: 'todo',
      needIds: fallIds,
    });
  }

  // Supplies
  const sup = finding('supplies');
  if (sup && need('kit')) {
    const sugar = plan.findings.some((f) => f.rule === 'supplies' && /glucose|strips|lancets/i.test(String(f.params.items)));
    add({
      id: 'supplies',
      level: 'now',
      title: sugar ? 'Blood sugar supplies are needed before the first check' : 'Care supplies are needed today',
      why: 'The papers ask for these at home right away.',
      quote: plan.findings.filter((f) => f.rule === 'supplies').slice(-1)[0]?.quote,
      action: 'Pick them up with the medicines.',
      tab: 'todo',
      needIds: ['kit'],
    });
  }

  // Rides and follow-up visits
  for (const n of plan.needs.filter((x) => x.id.startsWith('fu-ride-'))) {
    const a = plan.assignments[n.id];
    if (a?.owner.kind === 'crew') continue;
    add({
      id: `ride-${n.id}`,
      level: 'soon',
      title: `No one in the family can drive to the visit ${fmtWhen(t0, n.times?.[0] ?? a?.at ?? 0)}`,
      why: 'Missed follow-up visits are how small problems turn into a trip back to the hospital.',
      quote: quoteOf(n),
      action: a?.owner.kind === 'service' ? `Book it now: ${a.owner.name}.` : 'Ask someone to drive.',
      tab: 'todo',
      needIds: [n.id],
    });
  }
  for (const n of plan.needs.filter((x) => x.id.startsWith('fu-book-'))) {
    add({
      id: `book-${n.id}`,
      level: 'soon',
      title: n.title,
      why: 'Visits fill up. Booking now leaves time to set up a ride.',
      quote: quoteOf(n),
      action: 'Call today and book the ride at the same time.',
      tab: n.category === 'coverage' ? 'coverage' : 'todo',
      needIds: [n.id],
    });
  }

  // Caregiver strain
  for (const l of plan.loads) {
    if (l.level === 'ok') continue;
    const m = ctx.crew.find((x) => x.id === l.memberId);
    if (!m) continue;
    add({
      id: `load-${m.id}`,
      level: 'soon',
      title: `${m.name || 'One helper'} is carrying too much`,
      why: `${m.name} is with ${name} ${Math.round(l.dutyHours)} of ${plan.coverage.required} hours${l.overnights ? `, including ${l.overnights} ${l.overnights === 1 ? 'night' : 'nights'}` : ''}. Tired caregivers miss things.`,
      action: l.relief ? `Hand off ${fmtRange(t0, l.relief.start, l.relief.end)} to someone else.` : 'Share the shifts with someone else.',
      tab: 'helpers',
      needIds: [],
      resolved: done(`relief-${m.id}`),
    });
  }

  // Alone afterwards
  const coveredUntil = plan.presence.length ? Math.max(...plan.presence.map(([, e]) => e)) : 0;
  if (ctx.patient.livesAlone && coveredUntil < 72) {
    const checkIds = plan.needs.filter((n) => n.id.startsWith('checkin-') || n.id.startsWith('call-')).map((n) => n.id);
    add({
      id: 'alone',
      level: 'watch',
      title: `${name} will be alone after ${fmtWhen(t0, coveredUntil)}`,
      why: `${name} lives alone. Daily visits and calls catch problems early.`,
      action: 'Keep the morning visits and evening calls on the to-do list.',
      tab: 'todo',
      needIds: checkIds,
    });
  }

  // Money
  if (need('apply-fa')) {
    add({
      id: 'bill',
      level: 'soon',
      title: 'Ask about financial help before the hospital bill comes',
      why: 'Nonprofit hospitals must offer financial assistance, and applying early keeps the bill out of collections.',
      action: 'Apply this week. You have about 240 days, but sooner is easier.',
      tab: 'coverage',
      needIds: ['apply-fa'],
    });
  }
  if (finding('no-work') && need('apply-snap')) {
    add({
      id: 'income',
      level: 'soon',
      title: `Paychecks may stop while ${name} is off work`,
      why: 'Lost pay is when rent, food and medicine start competing.',
      quote: finding('no-work')?.quote,
      action: 'Apply for food assistance and call 211 about bills.',
      tab: 'coverage',
      needIds: ['apply-snap', ...(need('bills-211') ? ['bills-211'] : [])],
    });
  }

  // Calls that lock in counted help and are due soon
  for (const c of plan.calls) {
    if (c.status !== 'counted' || c.deadline > nowH + 6) continue;
    add({
      id: `call-${c.sourceId}`,
      level: 'now',
      title: `Call before ${fmtWhen(t0, Math.max(c.deadline, nowH))}: ${c.name}`,
      why: `It covers ${c.covers[0]?.toLowerCase() ?? 'part of the plan'}, but only if it starts in time.`,
      action: 'Use the script under Money.',
      tab: 'money',
      needIds: [],
      resolved: done(`call:${c.sourceId}`),
    });
  }

  flags.sort((a, b) => Number(a.resolved) - Number(b.resolved) || ORDER[a.level] - ORDER[b.level]);
  const warnings = plan.findings.filter((f) => f.rule === 'warning-signs').map((f) => f.quote);
  return { flags, warnings, open: flags.filter((f) => !f.resolved).length };
}
