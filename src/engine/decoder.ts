import type { Finding, FindingRule } from './types';

// The Discharge Decoder: a transparent, rule-based reader for discharge instructions.
// It never interprets clinical meaning. It only spots restrictions and logistics that
// create non-clinical work, and it always keeps the exact sentence it read.

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, 'twenty-four': 24, 'forty-eight': 48,
  'seventy-two': 72,
};

export function toNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const t = s.toLowerCase().trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return NUMBER_WORDS[t];
}

const NUM = String.raw`(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|twenty-four|forty-eight|seventy-two)`;

export interface Duration {
  hours: number;
  phrase: string;
}

const UNIT_HOURS: Record<string, number> = { hour: 1, hr: 1, day: 24, night: 24, week: 168, wk: 168, month: 720 };

export function parseDuration(s: string): Duration | undefined {
  const m = s.match(new RegExp(String.raw`\b${NUM}[\s-]*(hours?|hrs?|days?|nights?|weeks?|wks?|months?)\b`, 'i'));
  if (!m) return undefined;
  const n = toNumber(m[1]);
  if (n === undefined) return undefined;
  const unit = m[2].toLowerCase().replace(/s$/, '');
  const hours = n * (UNIT_HOURS[unit] ?? 24);
  const unitWord = unit === 'hr' ? 'hour' : unit === 'wk' ? 'week' : unit;
  return { hours, phrase: `${n} ${unitWord}${n === 1 ? '' : 's'}` };
}

const NEG = /\b(no|not|don'?t|do not|avoid|never|nothing|until|cannot|can'?t|should not|must not)\b/i;

type Partial = { label: string; params?: Finding['params'] } | null;
type RuleFn = (s: string) => Partial;

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.toLowerCase()))];

const listJoin = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const RULES: Array<{ rule: FindingRule; fn: RuleFn; multi?: boolean }> = [
  {
    rule: 'supervision',
    fn: (s) => {
      if (
        !/\b(stay with (you|the patient|him|her)|should not be (left )?alone|not be left alone|must not be alone|someone (should|must|needs to|will need to) (be|stay)|(24|twenty-four)[- ]hour supervision|supervision|responsible adult)\b/i.test(
          s,
        )
      )
        return null;
      const dur = parseDuration(s);
      const hours = dur?.hours ?? 24;
      return {
        label: `Needs someone with them for the first ${dur?.phrase ?? '24 hours'}`,
        params: { hours },
      };
    },
  },
  {
    rule: 'no-driving',
    fn: (s) => {
      if (!/\bdriv(e|ing)\b/i.test(s) || !NEG.test(s)) return null;
      const dur = parseDuration(s);
      return { label: dur ? `No driving for ${dur.phrase}` : 'No driving until cleared', params: { hours: dur?.hours ?? 0 } };
    },
  },
  {
    rule: 'lift-limit',
    fn: (s) => {
      if (!/\blift(ing)?\b/i.test(s) || !NEG.test(s)) return null;
      const w = s.match(/(\d+)\s*(?:lbs?|pounds?)\b/i);
      return { label: w ? `Can't lift more than ${w[1]} lb` : 'No heavy lifting', params: { lb: w ? Number(w[1]) : 0 } };
    },
  },
  {
    rule: 'mobility-device',
    fn: (s) => {
      const m = s.match(/\b(rollator|walker|crutches|cane|wheelchair|knee scooter)\b/i);
      if (!m) return null;
      const device = m[1].toLowerCase();
      return { label: `Uses a ${device}`, params: { device } };
    },
  },
  {
    rule: 'bath-safety',
    fn: (s) => {
      const items = uniq(
        [...s.matchAll(/\b(shower chair|shower bench|tub transfer bench|tub bench|raised toilet seat|toilet riser|bedside commode|commode|grab bars?)\b/gi)].map(
          (m) => m[1],
        ),
      ).map((x) => (x === 'grab bar' ? 'grab bars' : x));
      if (!items.length) return null;
      return { label: `Needs a ${listJoin(items)}`, params: { items } };
    },
  },
  {
    rule: 'adl-aids',
    fn: (s) => {
      const items = uniq(
        [...s.matchAll(/\b(reacher|grabber|sock aid|long[- ]handled (?:shoe ?horn|sponge)|dressing stick)\b/gi)].map((m) => m[1]),
      );
      if (!items.length) return null;
      return { label: `Will need a ${listJoin(items)}`, params: { items } };
    },
  },
  {
    rule: 'hospital-bed',
    fn: (s) => (/\bhospital bed\b/i.test(s) ? { label: 'Needs a hospital bed at home' } : null),
  },
  {
    rule: 'oxygen',
    fn: (s) =>
      /\b(home oxygen|oxygen (tank|concentrator|tubing|at home|delivery)|use (your )?oxygen)\b/i.test(s)
        ? { label: 'Going home on oxygen' }
        : null,
  },
  {
    rule: 'stairs',
    fn: (s) => {
      if (/\bfirst[- ]floor\b|\bone[- ]level\b|\bsingle[- ]level\b|\bdownstairs\b/i.test(s)) return { label: 'Should live on one floor for now' };
      if (/\b(stairs|staircase|steps)\b/i.test(s) && /\b(avoid|limit|no|not|minimi[sz]e)\b/i.test(s))
        return { label: 'Should avoid stairs' };
      return null;
    },
  },
  {
    rule: 'fall-risk',
    fn: (s) =>
      /\bfall risk\b|\brisk (of|for) fall|\bprevent falls\b|\bthrow rugs?\b|\bnight ?lights?\b|\btrip hazards?\b/i.test(s)
        ? { label: 'At risk of falling' }
        : null,
  },
  {
    rule: 'therapy',
    fn: (s) => {
      const long = s.match(/\b(physical therapy|occupational therapy|cardiac rehab(?:ilitation)?|pulmonary rehab(?:ilitation)?)\b/i);
      const short = /\b(outpatient )?PT\b/.test(s);
      if (!long && !short) return null;
      if (/\bhome (health|PT|physical therapy)\b/i.test(s)) return null;
      const f = s.match(new RegExp(String.raw`${NUM}\s*(?:times|x)\s*(?:a|per|\/)\s*week`, 'i'));
      const perWeek = f ? toNumber(f[1]) ?? 0 : 0;
      const start = parseDuration(s);
      const kind = long ? long[1].toLowerCase() : 'physical therapy';
      return {
        label: `Outpatient ${kind.replace(/^outpatient /, '')}${perWeek ? `, ${perWeek}x a week` : ''}`,
        params: { kind, perWeek, startsWithinH: start?.hours ?? 168 },
      };
    },
  },
  {
    rule: 'home-health',
    fn: (s) => {
      if (!/\bhome health\b|\b(visiting )?nurse will (visit|come|call)\b|\bvisiting nurse\b|\bhome (PT|physical therapy)\b/i.test(s)) return null;
      const d = parseDuration(s);
      return { label: `A home health visit${d ? ` within ${d.phrase}` : ''}`, params: { withinH: d?.hours ?? 48 } };
    },
  },
  {
    rule: 'follow-up',
    multi: true,
    fn: (s) => {
      if (
        !/\bfollow[- ]?up\b|\bappointment\b|\bsee (dr\.?|doctor|your (surgeon|doctor|cardiologist|provider|pcp))\b|\bsee an? (primary care )?(doctor|provider)\b|\bcheck[- ]up\b|\breturn to (the |your )?([\w-]+ )?(clinic|office)\b/i.test(s)
      )
        return null;
      if (/\b(physical|occupational) therapy\b|\bhome health\b|\bnurse will\b/i.test(s)) return null;
      // "No driving until you are cleared at your follow-up" is about driving, not a visit.
      if (/\bdriv(e|ing)\b|\breturn to work\b|\buntil (you are |you're )?cleared\b/i.test(s)) return null;
      const doc = s.match(/\bDr\.?\s+([A-Z][a-zA-Z'-]+)/);
      const spec = s.match(/\(([^)]{3,40})\)/);
      const time = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i);
      let hour = 10;
      if (time) {
        hour = Number(time[1]) % 12 + (/p/i.test(time[3]) ? 12 : 0) + (time[2] ? Number(time[2]) / 60 : 0);
      }
      let dayOffset: number | undefined;
      let weekday: number | undefined;
      let beyondPhrase: string | undefined;
      if (/\btomorrow\b/i.test(s)) dayOffset = 1;
      const inDays = s.match(new RegExp(String.raw`\b(?:in|within|after)\s+${NUM}(?:\s*(?:to|-)\s*\d+)?\s*days?\b`, 'i'));
      const inWeeks = s.match(new RegExp(String.raw`\b(?:in|within|after)\s+${NUM}(?:\s*(?:to|-)\s*\d+)?\s*weeks?\b`, 'i'));
      if (inDays) {
        const n = toNumber(inDays[1]) ?? 0;
        if (n <= 3) dayOffset = n;
        else beyondPhrase = `${n} days`;
      } else if (inWeeks) {
        const n = toNumber(inWeeks[1]) ?? 1;
        beyondPhrase = `${n} week${n === 1 ? '' : 's'}`;
      }
      const wd = s.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
      if (wd) weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(wd[1].toLowerCase());
      const role = s.match(/\b(?:your|the)\s+(surgeon|doctor|cardiologist|primary care (?:doctor|provider)|PCP|provider|specialist|[a-z]+ologist)\b/i);
      const clinic = s.match(/\b(?:the|your)\s+((?:[\w-]+\s+)?clinic)\b/i);
      const primary = /\bprimary care\b/i.test(s);
      const who = doc
        ? `Dr. ${doc[1]}`
        : clinic
          ? `the ${clinic[1].toLowerCase()}`
          : primary
            ? 'a primary care doctor'
            : role
              ? `the ${role[1].toLowerCase() === 'pcp' ? 'primary care doctor' : role[1].toLowerCase()}`
              : 'the doctor';
      const when =
        dayOffset !== undefined
          ? dayOffset === 1
            ? 'tomorrow'
            : `in ${dayOffset} days`
          : weekday !== undefined
            ? `on ${wd![1][0].toUpperCase()}${wd![1].slice(1).toLowerCase()}`
            : beyondPhrase
              ? `within ${beyondPhrase}`
              : 'soon';
      const params: Finding['params'] = { doctor: who, hour, beyond: dayOffset === undefined && weekday === undefined };
      if (spec) params.specialty = spec[1];
      if (dayOffset !== undefined) params.dayOffset = dayOffset;
      if (weekday !== undefined) params.weekday = weekday;
      if (beyondPhrase) params.beyondPhrase = beyondPhrase;
      return { label: `Follow-up with ${who}${spec ? ` (${spec[1]})` : ''} ${when}`, params };
    },
  },
  {
    rule: 'prescriptions',
    fn: (s) =>
      /\bprescriptions?\b.*\b(sent|called in|pick ?up|ready|fill)\b|\bpick up (your )?(new )?(meds|medications?|prescriptions?)\b|\bpharmacy\b/i.test(s)
        ? { label: /\binsulin\b/i.test(s) ? 'New prescriptions to pick up, including insulin' : 'New prescriptions to pick up', params: { insulin: /\binsulin\b/i.test(s) } }
        : null,
  },
  {
    rule: 'diet',
    fn: (s) => {
      if (!/\bdiet\b|\bfoods?\b|\bmeals?\b|\beat\b/i.test(s)) return null;
      const tags = uniq(
        [...s.matchAll(/\b(low[- ]sodium|low[- ]salt|heart[- ]healthy|diabetic|carb(?:ohydrate)?[- ]controlled|soft|pureed|low[- ]fat|renal|cardiac|clear liquid|full liquid|gluten[- ]free|high[- ]protein|high[- ]fiber)\b/gi)].map((m) =>
          m[1].replace(/\s+/g, '-'),
        ),
      );
      if (!tags.length) return null;
      return { label: `Meals must be ${listJoin(tags)}`, params: { tags } };
    },
  },
  {
    rule: 'bending',
    fn: (s) =>
      /\bhip precautions\b|\b(no|avoid|don'?t|do not)\b[^.]*\b(bend|bending|twist|twisting|stoop|stooping)\b/i.test(s)
        ? { label: 'No bending or twisting' }
        : null,
  },
  {
    rule: 'daily-weight',
    fn: (s) => (/\bweigh yourself\b|\bdaily weights?\b|\bweight every (day|morning)\b/i.test(s) ? { label: 'Needs a scale for daily weights' } : null),
  },
  {
    rule: 'supplies',
    multi: true,
    fn: (s) => {
      const items = uniq(
        [...s.matchAll(/\b(glucose meter|blood sugar meter|glucometer|test strips|lancets|gauze|dressing supplies|bandages|medical tape|saline|pen needles|syringes|sharps container)\b/gi)].map((m) => m[1]),
      );
      const sugar = /\b(check|test) your blood (sugar|glucose)\b/i.test(s);
      if (!items.length && !sugar) return null;
      const list = items.length ? items : ['glucose meter', 'test strips', 'lancets'];
      return { label: `Supplies to buy: ${listJoin(list)}`, params: { items: list } };
    },
  },
  {
    rule: 'no-work',
    fn: (s) => {
      if (!/\b(work|job)\b/i.test(s) || !/\b(no|not|don'?t|do not|until|off)\b/i.test(s) || /\bhomework|housework|work(s|ing)? (with|on) your\b/i.test(s)) return null;
      if (!/\b(return to work|go back to work|off work|out of work|stay home from work|not work)\b/i.test(s)) return null;
      const dur = parseDuration(s);
      return { label: dur ? `Off work for ${dur.phrase}` : 'Off work until cleared', params: { hours: dur?.hours ?? 0 } };
    },
  },
  {
    rule: 'no-housework',
    fn: (s) =>
      /\b(no|avoid|don'?t|do not)\b[^.]*\b(housework|house work|vacuum(ing)?|yard ?work|mow(ing)?|laundry|heavy chores|chores)\b/i.test(s)
        ? { label: 'No housework or chores' }
        : null,
  },
];

/** Split the papers into sentences while remembering their line numbers. */
export function sentences(text: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = [];
  text.split(/\r?\n/).forEach((raw, line) => {
    const cleaned = raw.replace(/^\s*(?:[-•*▪●◦]|\d+[.)]|[a-z][.)])\s+/i, '').trim();
    if (!cleaned) return;
    // Section headings like "FOLLOW-UP" or "Diet:" carry no instruction on their own.
    if (/^[^a-z]+$/.test(cleaned) && cleaned.length < 48) return;
    if (/^[\w /&-]{2,30}:$/.test(cleaned)) return;
    // Split on sentence ends, but not after titles like "Dr." or "Mrs."
    for (const part of cleaned.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|St|Jr|Sr|No|Approx|approx)\.)(?<=[.;!?])\s+(?=[A-Z])/)) {
      const t = part.trim();
      if (t.length > 2) out.push({ text: t, line });
    }
  });
  return out;
}

export function decode(papers: string): Finding[] {
  const found: Finding[] = [];
  const seen = new Set<FindingRule>();
  const seenFollowups = new Set<string>();
  for (const { text, line } of sentences(papers)) {
    for (const r of RULES) {
      if (!r.multi && seen.has(r.rule)) continue;
      const hit = r.fn(text);
      if (!hit) continue;
      if (r.rule === 'supplies') {
        const key = [...(hit.params?.items as string[])].sort().join('|');
        if (seenFollowups.has(`supplies:${key}`)) continue;
        seenFollowups.add(`supplies:${key}`);
      }
      if (r.rule === 'follow-up') {
        const key = String(hit.params?.doctor ?? '') + String(hit.params?.dayOffset ?? hit.params?.beyondPhrase ?? '');
        if (seenFollowups.has(key)) continue;
        seenFollowups.add(key);
      }
      seen.add(r.rule);
      found.push({
        id: `${r.rule}-${found.filter((f) => f.rule === r.rule).length}`,
        rule: r.rule,
        label: hit.label,
        quote: text,
        line,
        params: hit.params ?? {},
      });
    }
  }
  return found;
}
