import { atRel, dayName, PARTS, sourceById } from '../engine';
import type { View } from '../ui/view';

/** One printed page for the fridge: who's here when, what's happening, who to call. */
export function Fridge({ view }: { view: View }) {
  const { plan, input } = view;
  const t0 = plan.t0;
  const days = [...new Set(plan.blocks.filter((b) => b.end > 0).map((b) => b.d))];
  const cell = (d: number, p: number) => {
    const key = `${d}:${p}`;
    const b = plan.blocks.find((x) => x.key === key);
    if (!b || b.end <= 0) return '';
    const shifts = plan.shifts.filter((s) => s.blockKey === key);
    if (!shifts.length) return '';
    return shifts
      .map((s) => {
        if (s.memberId) return view.name(s.memberId);
        const gap = plan.gaps.find((g) => s.start >= g.start - 1e-9 && s.end <= g.end + 1e-9);
        return gap && view.gapBooked(gap.id) ? gap.funding.provider?.name ?? 'Paid help' : 'NOBODY YET';
      })
      .join(', ');
  };
  const tasksByDay = new Map<number, Array<{ at: number; text: string }>>();
  for (const n of plan.needs) {
    const a = plan.assignments[n.id];
    // The sheet goes up after arrival, so prep before discharge is already done.
    if (!a || n.presence || n.beyond || a.parts || a.at < 0) continue;
    const d = Math.floor((a.at - plan.blocks[0].start) / 24);
    const list = tasksByDay.get(d) ?? [];
    list.push({ at: a.at, text: `${view.when(a.at)}: ${n.title} (${view.ownerLabel(a.owner)})` });
    tasksByDay.set(d, list);
  }
  const phones = plan.calls
    .map((c) => ({ c, contact: sourceById(c.sourceId).contact(plan.ctx) }))
    .filter((x) => x.contact.phone);

  return (
    <section className="fridge" aria-hidden="true">
      <h1>{view.patientName}’s first 72 hours home</h1>
      <p className="sub">
        Home {dayName(t0, 0, true)}, {atRel(t0, 0).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} at {view.when(0).split(' ')[1]}. Made with First72.
      </p>
      {plan.coverage.required > 0 && (
        <>
          <h2>Who is here</h2>
          <table>
            <thead>
              <tr>
                <th />
                {PARTS.map((p) => (
                  <th key={p.label}>
                    {p.label} {p.range}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d}>
                  <th>{dayName(t0, d, true)}</th>
                  {PARTS.map((_, p) => {
                    const v = cell(d, p);
                    return (
                      <td key={p} className={v.includes('NOBODY') ? 'gapcell' : undefined}>
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="two">
        <div>
          <h2>What’s happening</h2>
          {[...tasksByDay.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([d, list]) => (
              <div key={d}>
                <b>{dayName(t0, d, true)}</b>
                <ul>
                  {list
                    .sort((a, b) => a.at - b.at)
                    .map((x) => (
                      <li key={x.text}>{x.text}</li>
                    ))}
                </ul>
              </div>
            ))}
        </div>
        <div>
          <h2>Family</h2>
          <ul>
            {input.crew.map((m) => (
              <li key={m.id}>
                {m.name}
                {m.relation ? `, ${m.relation}` : ''}
                {m.phone ? `: ${m.phone}` : ''}
              </li>
            ))}
          </ul>
          <h2>Numbers</h2>
          <ul>
            {phones.map(({ c, contact }) => (
              <li key={c.sourceId}>
                {c.name}: {contact.phone}
              </li>
            ))}
          </ul>
          <p className="safety">Medical questions: call the number on the discharge papers. Emergency: call 911.</p>
        </div>
      </div>
    </section>
  );
}
