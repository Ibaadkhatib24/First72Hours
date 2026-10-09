import { fmtRange } from '../engine';
import type { View } from './view';

export interface MemberPlan {
  shifts: Array<{ start: number; end: number }>;
  tasks: Array<{ at: number; title: string; needId: string }>;
  meals: number;
}

export function memberPlan(view: View, memberId: string): MemberPlan {
  const { plan } = view;
  const shifts: MemberPlan['shifts'] = [];
  for (const s of plan.shifts) {
    if (s.memberId !== memberId) continue;
    const last = shifts[shifts.length - 1];
    if (last && Math.abs(last.end - s.start) < 1e-9) last.end = s.end;
    else shifts.push({ start: s.start, end: s.end });
  }
  const tasks: MemberPlan['tasks'] = [];
  let meals = 0;
  for (const n of plan.needs) {
    const a = plan.assignments[n.id];
    if (!a) continue;
    if (a.parts) {
      meals += a.parts.filter((p) => p.owner.kind === 'crew' && p.owner.memberId === memberId).length;
      continue;
    }
    if (a.owner.kind === 'crew' && a.owner.memberId === memberId) tasks.push({ at: a.at, title: n.title, needId: n.id });
  }
  tasks.sort((a, b) => a.at - b.at);
  return { shifts, tasks, meals };
}

/** A text message someone can send to a helper with just their part. */
export function memberMessage(view: View, memberId: string, link: string): string {
  const name = view.name(memberId);
  const mp = memberPlan(view, memberId);
  const lines = [`Hi ${name}! Here’s your part of ${view.patientName}’s first 72 hours home.`];
  if (mp.shifts.length) lines.push('', `With ${view.patientName}:`, ...mp.shifts.map((s) => `• ${fmtRange(view.plan.t0, s.start, s.end)}`));
  if (mp.tasks.length) lines.push('', 'Tasks:', ...mp.tasks.map((t) => `• ${view.when(t.at)}: ${t.title}`));
  if (mp.meals) lines.push('', `Plus ${mp.meals} meal${mp.meals === 1 ? '' : 's'} while you’re there.`);
  lines.push('', `Your list and the full plan: ${link}`);
  return lines.join('\n');
}

export function smsHref(text: string, phone = ''): string {
  return `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text)}`;
}
