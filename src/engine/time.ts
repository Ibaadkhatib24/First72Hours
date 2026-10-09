// Everything in the engine is measured in hours relative to discharge ("Hour 0").
// Negative hours are the prep time before the patient leaves the hospital.

export const WINDOW_H = 72;
export const HOUR_MS = 3_600_000;

export const PARTS = [
  { label: 'Overnight', range: '12a–6a', startHour: 0 },
  { label: 'Morning', range: '6a–12p', startHour: 6 },
  { label: 'Afternoon', range: '12p–6p', startHour: 12 },
  { label: 'Evening', range: '6p–12a', startHour: 18 },
] as const;

/** A 6-hour slice of a calendar day. Availability is set per block. */
export interface Block {
  key: string; // `${dayIndex}:${part}`
  d: number; // calendar day index, 0 = discharge day
  p: number; // 0 overnight, 1 morning, 2 afternoon, 3 evening
  start: number; // hours relative to discharge
  end: number;
}

export function parseLocal(s: string): Date {
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relHours(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / HOUR_MS;
}

export function atRel(t0: Date, h: number): Date {
  return new Date(t0.getTime() + h * HOUR_MS);
}

/** Hours from discharge back to midnight of the discharge day (always <= 0). */
export function dayZeroRel(t0: Date): number {
  return -(t0.getHours() + t0.getMinutes() / 60);
}

/** Relative hour for a given calendar day index and clock hour. */
export function clockRel(t0: Date, dayIndex: number, hour: number): number {
  return dayZeroRel(t0) + dayIndex * 24 + hour;
}

/** The next time the clock reads `hour` at or after relative hour `after`. */
export function nextClockRel(t0: Date, hour: number, after: number): number {
  const base = dayZeroRel(t0);
  let d = Math.floor((after - base - hour) / 24);
  let r = base + d * 24 + hour;
  while (r < after) {
    d += 1;
    r = base + d * 24 + hour;
  }
  return r;
}

/** All blocks from midnight of discharge day through Hour 72. */
export function buildBlocks(t0: Date): Block[] {
  const base = dayZeroRel(t0);
  const out: Block[] = [];
  for (let d = 0; d < 4; d++) {
    for (let p = 0; p < 4; p++) {
      const start = base + d * 24 + p * 6;
      if (start >= WINDOW_H) continue;
      out.push({ key: `${d}:${p}`, d, p, start, end: Math.min(start + 6, WINDOW_H) });
    }
  }
  return out;
}

export function blockAt(blocks: Block[], h: number): Block | undefined {
  return blocks.find((b) => h >= b.start && h < b.end);
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayName(t0: Date, dayIndex: number, long = false): string {
  const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + dayIndex);
  return (long ? DAYS_LONG : DAYS)[d.getDay()];
}

export function fmtClock(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'am' : 'pm';
  return m === 0 ? `${h12}${suffix}` : `${h12}:${pad(m)}${suffix}`;
}

/** "Tue 4pm" */
export function fmtWhen(t0: Date, h: number): string {
  const d = atRel(t0, h);
  return `${DAYS[d.getDay()]} ${fmtClock(d)}`;
}

/** "Tue 4–8pm" style range. */
export function fmtRange(t0: Date, a: number, b: number): string {
  const da = atRel(t0, a);
  const db = atRel(t0, b);
  const sameDay = da.toDateString() === atRel(t0, b - 0.01).toDateString();
  if (sameDay) return `${DAYS[da.getDay()]} ${fmtClock(da)}–${fmtClock(db)}`;
  return `${DAYS[da.getDay()]} ${fmtClock(da)} – ${DAYS[db.getDay()]} ${fmtClock(db)}`;
}

/** "Hour 14" or "4h before discharge" */
export function fmtHourMark(h: number): string {
  if (h < 0) return `${Math.round(-h)}h before discharge`;
  return `Hour ${Math.round(h)}`;
}
