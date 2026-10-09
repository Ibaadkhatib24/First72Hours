import { decode } from './decoder';
import { fundItems, fundService, type Ctx, type Funding, type Range, type SourceOption } from './funding';
import { buildNeeds, RATES } from './needs';
import { blockAt, buildBlocks, fmtRange, parseLocal, relHours, toLocalIso, WINDOW_H, type Block } from './time';
import type { CaseInput, CrewMember, Eligibility, Finding, Need, SourceKind } from './types';

export interface Shift {
  memberId: string | null;
  start: number;
  end: number;
  blockKey: string;
}

export type Owner =
  | { kind: 'crew'; memberId: string }
  | { kind: 'service'; sourceId: string; name: string }
  | { kind: 'none' };

export interface Assignment {
  needId: string;
  owner: Owner;
  at: number;
  /** Purchases that cost money whoever does the task. */
  items?: Funding;
  /** Paid or benefit help when the service does the task. */
  service?: Funding;
  /** If a family member owns it: what could replace them. */
  backup?: SourceOption;
  /** Part of the task a benefit covers (e.g. plan meals arrive for lunch and dinner). */
  benefitShare?: { count: number; total: number; funding: Funding };
  /** Meal-by-meal breakdown. */
  parts?: Part[];
  /** Everything this assignment spends or draws from benefits (summed into the totals). */
  spend: Funding[];
}

export interface Part {
  at: number;
  owner: Owner;
  paid?: 'benefit' | 'delivery';
}

export interface Gap {
  id: string;
  start: number;
  end: number;
  hours: number;
  overnight: boolean;
  funding: Funding;
}

export interface Load {
  memberId: string;
  dutyHours: number;
  taskHours: number;
  overnights: number;
  longestStreak: number;
  level: 'ok' | 'heavy' | 'overloaded';
  relief?: { start: number; end: number; funding: Funding };
}

export interface Totals {
  cost: Range;
  benefits: Range;
  youPay: Range;
  hsaEligible: Range;
  chipIns: number;
  perChipIn: Range;
}

export interface Plan {
  t0: Date;
  plannedH: number;
  blocks: Block[];
  findings: Finding[];
  needs: Need[];
  presence: Array<[number, number]>;
  shifts: Shift[];
  gaps: Gap[];
  assignments: Record<string, Assignment>;
  loads: Load[];
  totals: Totals;
  coverage: { required: number; covered: number };
  /** Extra benefits if planning had started two days before discharge. */
  earlyBonus: number;
  /** Slow sources worth starting today for next week. */
  startNow: SourceOption[];
  /** Every call worth making, most urgent first. */
  calls: Call[];
  unowned: string[];
  ctx: Ctx;
}

export interface Call {
  sourceId: string;
  name: string;
  kind: SourceKind;
  eligibility: Eligibility;
  /** counted: in the totals. ask: might help, worth the call. later: too slow for this week, start now. */
  status: 'counted' | 'ask' | 'later';
  /** Relative hour to call by so it starts in time. */
  deadline: number;
  covers: string[];
  /** Help this source can't reach in time (the lead-time problem, made visible). */
  tooSlowFor: string[];
  value: Range;
  needId: string;
  at: number;
}

const add = (a: Range, b: Range): Range => ({ low: a.low + b.low, high: a.high + b.high });
const zero = (): Range => ({ low: 0, high: 0 });
export const mid = (r: Range) => (r.low + r.high) / 2;

const STREAK_LIMIT = 12;

function canDo(m: CrewMember, need: Need): boolean {
  if (need.where !== 'remote' && m.distance === 'far') return false;
  if (need.req.car && !m.hasCar) return false;
  if (need.req.lift && !m.canLift) return false;
  return true;
}

/** Build round-the-clock shifts from everyone's availability. Uncovered time becomes a gap. */
function buildRoster(blocks: Block[], presence: Array<[number, number]>, crew: CrewMember[]) {
  const shifts: Shift[] = [];
  const duty = new Map<string, number>(crew.map((m) => [m.id, 0]));
  let streakMember: string | null = null;
  let streak = 0;
  for (const b of blocks) {
    for (const [ws, we] of presence) {
      const s = Math.max(b.start, ws);
      const e = Math.min(b.end, we);
      if (e <= s) continue;
      const len = e - s;
      const cands = crew.filter((m) => m.distance !== 'far' && m.availability.includes(b.key));
      let pick: CrewMember | undefined;
      const prev = cands.find((m) => m.id === streakMember);
      if (prev && (streak + len <= STREAK_LIMIT || cands.length === 1)) pick = prev;
      else {
        const pool = cands.length > 1 ? cands.filter((m) => m.id !== streakMember) : cands;
        pick = [...pool].sort((a, b2) => duty.get(a.id)! - duty.get(b2.id)!)[0];
      }
      const last = shifts[shifts.length - 1];
      const contiguous = last && Math.abs(last.end - s) < 1e-9;
      if (pick) {
        duty.set(pick.id, duty.get(pick.id)! + len);
        streak = contiguous && last.memberId === pick.id ? streak + len : len;
        streakMember = pick.id;
      } else {
        streak = 0;
        streakMember = null;
      }
      shifts.push({ memberId: pick?.id ?? null, start: s, end: e, blockKey: b.key });
    }
  }
  return { shifts, duty };
}

export interface PlanOptions {
  /** Skip the "what if you'd started earlier" comparison (used internally). */
  skipEarly?: boolean;
}

export function planCase(input: CaseInput, opts: PlanOptions = {}): Plan {
  const t0 = parseLocal(input.dischargeAt);
  const plannedH = relHours(t0, parseLocal(input.plannedAt));
  const findings = decode(input.papers);
  const { needs, presence } = buildNeeds(input, findings);
  const blocks = buildBlocks(t0);
  const crew = input.crew;
  const device = findings.find((f) => f.rule === 'mobility-device')?.params.device as string | undefined;
  const ctx: Ctx = { patient: input.patient, crew, plannedH, t0, device };

  // 1. Who is physically there, hour by hour.
  const { shifts, duty } = buildRoster(blocks, presence, crew);
  const shiftAt = (h: number) => shifts.find((s) => h >= s.start && h < s.end);

  // 2. Gaps: merge adjacent uncovered shifts and price them.
  const gaps: Gap[] = [];
  for (const s of shifts) {
    if (s.memberId) continue;
    const last = gaps[gaps.length - 1];
    if (last && Math.abs(last.end - s.start) < 1e-9) {
      last.end = s.end;
    } else {
      gaps.push({ id: `gap-${gaps.length}`, start: s.start, end: s.end, hours: 0, overnight: false, funding: undefined as unknown as Funding });
    }
  }
  for (const g of gaps) {
    g.hours = g.end - g.start;
    g.overnight = blocks.some((b) => b.p === 0 && b.start < g.end && b.end > g.start);
    g.funding = fundService('companion', { low: RATES.careHour.low * g.hours, high: RATES.careHour.high * g.hours }, ctx, g.start);
  }

  // 3. Give every task an owner: family first, then benefits and paid help.
  const assignments: Record<string, Assignment> = {};
  const taskLoad = new Map<string, number>(crew.map((m) => [m.id, 0]));
  const busy = new Map<string, Array<{ s: number; e: number; needId: string }>>(crew.map((m) => [m.id, []]));
  const isBusy = (id: string, t: number, d: number, except?: string) =>
    busy.get(id)!.some((x) => x.needId !== except && x.s < t + d - 1e-9 && t < x.e - 1e-9);
  const book = (id: string, t: number, d: number, needId: string) => {
    busy.get(id)!.push({ s: t, e: t + d, needId });
    taskLoad.set(id, taskLoad.get(id)! + d);
  };
  const unowned: string[] = [];
  const ordered = needs.filter((n) => !n.presence).sort((a, b) => a.window[0] - b.window[0] || a.window[1] - b.window[1]);

  for (const need of ordered) {
    const items = need.items?.length ? fundItems(need, ctx, need.window[1]) : undefined;
    const serviceAt = need.beyond ? need.times?.[0] ?? need.window[0] : need.window[0];
    const serviceFunding = () =>
      need.service && need.serviceCost ? fundService(need.service, need.serviceCost, ctx, serviceAt, need.medical) : undefined;
    const spend: Funding[] = items ? [items] : [];

    // Meals: decide meal by meal. Plan benefits first (once they can arrive), then whoever is there, then delivery.
    if (need.pin === 'meal' && need.times?.length && need.service && need.serviceCost) {
      const times = need.times;
      const per = { low: need.serviceCost.low / times.length, high: need.serviceCost.high / times.length };
      const probe = fundService(need.service, per, ctx, times[times.length - 1], need.medical);
      const benefit = probe.provider && probe.provider.kind !== 'private' && probe.youPay.high === 0 ? probe.provider : undefined;
      const parts: Part[] = [];
      for (const t of times) {
        if (benefit && t >= benefit.readyAt - 1e-9) {
          parts.push({ at: t, owner: { kind: 'service', sourceId: benefit.sourceId, name: benefit.name }, paid: 'benefit' });
          continue;
        }
        const b = blockAt(blocks, t);
        const onShift = shiftAt(t)?.memberId;
        const cook =
          crew.find((m) => m.id === onShift) ??
          crew.find((m) => m.distance !== 'far' && b && m.availability.includes(b.key) && !isBusy(m.id, t - 0.5, 0.5));
        const gap = gaps.find((g) => t >= g.start && t < g.end && g.funding.provider);
        if (cook) {
          parts.push({ at: t, owner: { kind: 'crew', memberId: cook.id } });
          book(cook.id, t - 0.5, 0.5, need.id);
        } else if (gap) {
          // Whoever covers the gap can heat a meal.
          parts.push({ at: t, owner: { kind: 'service', sourceId: gap.funding.provider!.sourceId, name: gap.funding.provider!.name } });
        } else {
          parts.push({ at: t, owner: { kind: 'service', sourceId: 'meal-delivery', name: 'Meal delivery' }, paid: 'delivery' });
        }
      }
      const nBenefit = parts.filter((x) => x.paid === 'benefit');
      const nDelivery = parts.filter((x) => x.paid === 'delivery');
      let benefitShare: Assignment['benefitShare'];
      if (nBenefit.length) {
        const f = fundService(need.service, { low: per.low * nBenefit.length, high: per.high * nBenefit.length }, ctx, nBenefit[0].at, need.medical);
        benefitShare = { count: nBenefit.length, total: times.length, funding: f };
        spend.push(f);
      }
      let delivery: Funding | undefined;
      if (nDelivery.length) {
        delivery = fundService(need.service, { low: per.low * nDelivery.length, high: per.high * nDelivery.length }, ctx, nDelivery[0].at, need.medical);
        spend.push(delivery);
      }
      const tally = new Map<string, number>();
      for (const x of parts) if (x.owner.kind === 'crew') tally.set(x.owner.memberId, (tally.get(x.owner.memberId) ?? 0) + 1);
      const lead = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
      const owner: Owner = lead
        ? { kind: 'crew', memberId: lead[0] }
        : benefit && nBenefit.length === times.length
          ? { kind: 'service', sourceId: benefit.sourceId, name: benefit.name }
          : { kind: 'service', sourceId: 'meal-delivery', name: 'Meal delivery' };
      assignments[need.id] = { needId: need.id, owner, at: times[0], items, service: delivery, benefitShare, parts, spend };
      continue;
    }

    let best: { m: CrewMember; at: number; score: number } | undefined;
    for (let t = need.window[0]; t <= need.window[1] + 1e-9; t += 0.5) {
      const b = blockAt(blocks, Math.max(t, blocks[0].start));
      if (!b) continue;
      const here = shiftAt(t);
      for (const m of crew) {
        if (!canDo(m, need) || !m.availability.includes(b.key)) continue;
        if (isBusy(m.id, t, need.duration, need.pairWith)) continue;
        let score = taskLoad.get(m.id)! + (duty.get(m.id) ?? 0) * 0.05;
        const paired = need.pairWith ? assignments[need.pairWith]?.owner : undefined;
        if (paired?.kind === 'crew' && paired.memberId === m.id) score -= 100;
        if (need.where === 'home' && here?.memberId === m.id) score -= 50;
        if (need.where === 'remote' && m.distance === 'far') score -= 20;
        if (need.where === 'remote' && here?.memberId === m.id) score += 5;
        if (!best || score < best.score - 1e-9) best = { m, at: t, score };
      }
      if (best) break; // earliest workable time wins
    }

    if (best) {
      book(best.m.id, best.at, need.duration, need.id);
      const f = serviceFunding();
      assignments[need.id] = {
        needId: need.id,
        owner: { kind: 'crew', memberId: best.m.id },
        at: best.at,
        items,
        backup: f?.provider,
        // Prep for later: show how it can be paid for, but don't count it in the 72-hour totals.
        service: need.beyond ? f : undefined,
        spend,
      };
      continue;
    }
    const f = serviceFunding();
    if (f?.provider) {
      assignments[need.id] = {
        needId: need.id,
        owner: { kind: 'service', sourceId: f.provider.sourceId, name: f.provider.name },
        at: need.window[0],
        items,
        service: f,
        spend: need.beyond ? spend : [...spend, f],
      };
    } else {
      unowned.push(need.id);
      assignments[need.id] = { needId: need.id, owner: { kind: 'none' }, at: need.window[0], items, service: f, spend };
    }
  }

  // 4. Caregiver load and relief.
  const loads: Load[] = crew.map((m) => {
    const mine = shifts.filter((s) => s.memberId === m.id);
    const dutyHours = mine.reduce((a, s) => a + s.end - s.start, 0);
    const overnights = new Set(mine.filter((s) => s.blockKey.endsWith(':0')).map((s) => s.blockKey)).size;
    let longest = 0;
    let run = 0;
    let runStart = 0;
    let bestRun: [number, number] = [0, 0];
    let prevEnd = -Infinity;
    for (const s of mine) {
      if (Math.abs(s.start - prevEnd) < 1e-9) run += s.end - s.start;
      else {
        run = s.end - s.start;
        runStart = s.start;
      }
      prevEnd = s.end;
      if (run > longest) {
        longest = run;
        bestRun = [runStart, s.end];
      }
    }
    const taskHours = needs.filter((n) => assignments[n.id]?.owner.kind === 'crew' && (assignments[n.id].owner as { memberId: string }).memberId === m.id).reduce((a, n) => a + n.duration, 0);
    const level: Load['level'] = dutyHours >= 36 || longest >= 18 ? 'overloaded' : dutyHours >= 24 || longest >= 14 || overnights >= 2 ? 'heavy' : 'ok';
    let relief: Load['relief'];
    if (level !== 'ok') {
      // Hand off one of their overnights (prefer the latest), or the middle of their longest stretch.
      const nights = mine.filter((s) => s.blockKey.endsWith(':0'));
      const pickShift = nights.length >= 2 ? nights[nights.length - 1] : mine.find((s) => s.start >= bestRun[0] + (bestRun[1] - bestRun[0]) / 3 && s.end <= bestRun[1]) ?? mine[0];
      if (pickShift) {
        const hours = pickShift.end - pickShift.start;
        relief = {
          start: pickShift.start,
          end: pickShift.end,
          funding: fundService('companion', { low: RATES.careHour.low * hours, high: RATES.careHour.high * hours }, ctx, pickShift.start),
        };
      }
    }
    return { memberId: m.id, dutyHours, taskHours, overnights, longestStreak: longest, level, relief };
  });

  // 5. Money.
  let cost = zero();
  let benefits = zero();
  let youPay = zero();
  let hsaEligible = zero();
  const fundings: Funding[] = [];
  for (const need of needs) {
    const a = assignments[need.id];
    if (a) fundings.push(...a.spend);
  }
  for (const g of gaps) if (!g.funding.unfillable) fundings.push(g.funding);
  for (const f of fundings) {
    cost = add(cost, f.cost);
    youPay = add(youPay, f.youPay);
    for (const l of f.layers) benefits = add(benefits, l);
    if (f.hsa) hsaEligible = add(hsaEligible, f.youPay);
  }
  const chipIns = Math.max(1, crew.filter((m) => m.chipIn).length);
  const totals: Totals = {
    cost,
    benefits,
    youPay,
    hsaEligible,
    chipIns,
    perChipIn: { low: youPay.low / chipIns, high: youPay.high / chipIns },
  };

  const required = presence.reduce((a, [s, e]) => a + Math.max(0, Math.min(e, WINDOW_H) - s), 0);
  const covered = required - gaps.reduce((a, g) => a + g.hours, 0);

  // 6. Slow help worth starting today.
  const startNow = new Map<string, SourceOption>();
  const allOptions = [...fundings.flatMap((f) => f.options), ...gaps.flatMap((g) => g.funding.options), ...Object.values(assignments).flatMap((a) => [...(a.service?.options ?? [])])];
  for (const n of needs.filter((x) => x.service && !x.presence)) {
    const f = n.serviceCost ? fundService(n.service!, n.serviceCost, ctx, WINDOW_H, n.medical) : undefined;
    if (f) allOptions.push(...f.options);
  }
  for (const o of allOptions) {
    if (o.kind === 'private' || o.eligibility === 'no' || o.inTime || o.readyAt <= 24) continue;
    if (!startNow.has(o.sourceId)) startNow.set(o.sourceId, o);
  }

  // 7. The call list: every non-private source we used or could use, with a call-by time.
  const calls = new Map<string, Call>();
  const track = (f: Funding | undefined, at: number, label: string, needId: string, inTotals: boolean) => {
    if (!f) return;
    const counted = new Set(f.layers.map((l) => l.sourceId));
    for (const o of f.options) {
      if (o.kind === 'private' || o.eligibility === 'no') continue;
      const lead = o.readyAt - plannedH;
      const status: Call['status'] = counted.has(o.sourceId) && inTotals ? 'counted' : o.inTime ? 'ask' : 'later';
      const layer = f.layers.find((l) => l.sourceId === o.sourceId);
      const prev = calls.get(o.sourceId);
      const rank = { counted: 0, ask: 1, later: 2 } as const;
      if (!prev) {
        calls.set(o.sourceId, {
          sourceId: o.sourceId,
          name: o.name,
          kind: o.kind,
          eligibility: o.eligibility,
          status,
          deadline: o.inTime ? at - lead : Infinity,
          covers: o.inTime ? [label] : [],
          tooSlowFor: o.inTime ? [] : [label],
          value: layer && inTotals ? { low: layer.low, high: layer.high } : zero(),
          needId,
          at,
        });
        continue;
      }
      const list = o.inTime ? prev.covers : prev.tooSlowFor;
      if (!list.includes(label)) list.push(label);
      if (layer && inTotals) prev.value = add(prev.value, layer);
      if (rank[status] < rank[prev.status]) {
        prev.status = status;
        prev.needId = needId;
        prev.at = at;
      }
      if (o.inTime) prev.deadline = Math.min(prev.deadline, at - lead);
    }
  };
  const fmtGap = (g: Gap) => `Someone there ${fmtRange(t0, g.start, g.end)}`;
  for (const need of needs) {
    const a = assignments[need.id];
    if (!a) continue;
    const label = need.short ?? need.title;
    track(a.items, need.window[1], label, need.id, true);
    if (a.benefitShare) track(a.benefitShare.funding, a.parts?.find((x) => x.paid === 'benefit')?.at ?? need.window[0], label, need.id, true);
    if (a.service) track(a.service, need.beyond ? need.times?.[0] ?? need.window[0] : need.window[0], label, need.id, !need.beyond && a.owner.kind === 'service');
  }
  for (const g of gaps) track(g.funding, g.start, fmtGap(g), 'presence', true);
  for (const l of loads) {
    const m = crew.find((x) => x.id === l.memberId);
    if (l.relief && m) track(l.relief.funding, l.relief.start, `A break for ${m.name}, ${fmtRange(t0, l.relief.start, l.relief.end)}`, 'presence', false);
  }
  for (const o of startNow.values()) {
    if (!calls.has(o.sourceId)) {
      calls.set(o.sourceId, { sourceId: o.sourceId, name: o.name, kind: o.kind, eligibility: o.eligibility, status: 'later', deadline: plannedH, covers: ['Help after the first 72 hours'], tooSlowFor: [], value: zero(), needId: needs[0].id, at: WINDOW_H });
    }
  }
  for (const c of calls.values()) if (c.status === 'later' || !Number.isFinite(c.deadline)) c.deadline = plannedH;
  const rankOf = { counted: 0, ask: 1, later: 2 } as const;
  const callList = [...calls.values()].sort((a, b) => rankOf[a.status] - rankOf[b.status] || a.deadline - b.deadline);

  let earlyBonus = 0;
  if (!opts.skipEarly && plannedH > -48) {
    const early = planCase({ ...input, plannedAt: toLocalIso(new Date(t0.getTime() - 48 * 3_600_000)) }, { skipEarly: true });
    earlyBonus = Math.max(0, Math.round(mid(early.totals.benefits) - mid(benefits)));
  }

  return {
    t0,
    plannedH,
    blocks,
    findings,
    needs,
    presence,
    shifts,
    gaps,
    assignments,
    loads,
    totals,
    coverage: { required, covered },
    earlyBonus,
    startNow: [...startNow.values()],
    calls: callList,
    unowned,
    ctx,
  };
}
