import type { Range } from '../engine';

const round = (n: number, to = 5) => Math.round(n / to) * to;

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** "$40–$56" or "$0" */
export function moneyRange(r: Range): string {
  const lo = round(r.low);
  const hi = round(r.high);
  if (hi <= 0) return '$0';
  if (lo === hi) return money(lo);
  return `${money(lo)}–${money(hi)}`;
}

/** "about $450" style midpoint, rounded to $10. */
export function about(r: Range): string {
  return money(round((r.low + r.high) / 2, 10));
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export const CREW_COLORS = ['#2f6fdb', '#a8620a', '#8a4fbf', '#0b7878', '#c2477a', '#4f7a1f'];

export function crewColor(index: number) {
  return CREW_COLORS[index % CREW_COLORS.length];
}

export function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || 'them';
}
