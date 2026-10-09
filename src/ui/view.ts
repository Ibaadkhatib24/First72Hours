import { fmtWhen, type CaseInput, type Owner, type Plan, type Status } from '../engine';
import { crewColor, firstName } from './format';

/** Small helpers every plan component needs. */
export interface View {
  plan: Plan;
  input: CaseInput;
  status: Record<string, Status>;
  setStatus: (id: string, s: Status) => void;
  patientName: string;
  color: (memberId: string) => string;
  name: (memberId: string) => string;
  ownerLabel: (o: Owner) => string;
  when: (h: number) => string;
  nowH: number;
  /** Gap is booked once the call that covers it is confirmed. */
  gapBooked: (gapId: string) => boolean;
}

export function makeView(plan: Plan, input: CaseInput, status: Record<string, Status>, setStatus: View['setStatus'], now: Date): View {
  const index = new Map(input.crew.map((m, i) => [m.id, i]));
  const names = new Map(input.crew.map((m) => [m.id, m.name || 'Helper']));
  const view: View = {
    plan,
    input,
    status,
    setStatus,
    patientName: firstName(input.patient.name),
    color: (id) => crewColor(index.get(id) ?? 0),
    name: (id) => names.get(id) ?? 'Helper',
    ownerLabel: (o) => (o.kind === 'crew' ? names.get(o.memberId) ?? 'Helper' : o.kind === 'service' ? o.name : 'Needs someone'),
    when: (h) => fmtWhen(plan.t0, h),
    nowH: (now.getTime() - plan.t0.getTime()) / 3_600_000,
    gapBooked: (gapId) => {
      const g = plan.gaps.find((x) => x.id === gapId);
      if (!g?.funding.provider) return status[gapId] === 'done';
      return status[gapId] === 'done' || status[`call:${g.funding.provider.sourceId}`] === 'done';
    },
  };
  return view;
}
