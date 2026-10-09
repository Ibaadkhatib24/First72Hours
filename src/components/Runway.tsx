import { useState, type CSSProperties, type FocusEvent, type MouseEvent } from 'react';
import { clockRel, dayName, fmtRange, WINDOW_H, type Shift } from '../engine';
import type { View } from '../ui/view';

// The runway: 72 hours left to right under a real sky (night, dawn, day, dusk), with who
// is there, what happens when, and red hatching wherever nobody is.

const SKY: Array<[number, string]> = [
  [0, 'var(--sky-night)'],
  [5, 'var(--sky-night)'],
  [6.5, 'var(--sky-dawn)'],
  [9, 'var(--sky-day)'],
  [16, 'var(--sky-day)'],
  [18, 'var(--sky-dawn)'],
  [19.5, 'var(--sky-dusk)'],
  [21.5, 'var(--sky-night)'],
  [24, 'var(--sky-night)'],
];

type Tip = { x: number; y: number; title: string; body?: string } | null;

function mergeShifts(shifts: Shift[]) {
  const out: Array<{ memberId: string | null; start: number; end: number }> = [];
  for (const s of shifts) {
    const last = out[out.length - 1];
    if (last && last.memberId === s.memberId && Math.abs(last.end - s.start) < 1e-9) last.end = s.end;
    else out.push({ memberId: s.memberId, start: s.start, end: s.end });
  }
  return out;
}

export function Runway({ view, onPick }: { view: View; onPick: (needId: string) => void }) {
  const { plan, input } = view;
  const t0 = plan.t0;
  // Start a little before planning began so the first prep tasks aren't clipped.
  const xMin = Math.max(Math.min(Math.floor(plan.plannedH) - 1, -1), plan.blocks[0]?.start ?? -1);
  const xMax = WINDOW_H;
  const span = xMax - xMin;
  const pct = (h: number) => `${((Math.min(Math.max(h, xMin), xMax) - xMin) / span) * 100}%`;
  const width = (a: number, b: number) => `${((Math.min(b, xMax) - Math.max(a, xMin)) / span) * 100}%`;
  const [tip, setTip] = useState<Tip>(null);

  const show = (title: string, body?: string) => (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2 - 140, 8), window.innerWidth - 296);
    setTip({ x, y: r.bottom + 8, title, body });
  };
  const hide = () => setTip(null);
  const tipProps = (title: string, body?: string) => ({
    onMouseEnter: show(title, body),
    onMouseLeave: hide,
    onFocus: show(title, body),
    onBlur: hide,
  });

  // Sky gradient, one stop per hour of clock time.
  const stops: string[] = [];
  for (let h = Math.ceil(xMin); h <= xMax; h++) {
    const clock = (((t0.getHours() + t0.getMinutes() / 60 + h) % 24) + 24) % 24;
    let color = SKY[0][1];
    for (const [c, col] of SKY) if (clock >= c) color = col;
    stops.push(`${color} ${(((h - xMin) / span) * 100).toFixed(2)}%`);
  }
  const sky = `linear-gradient(90deg, ${stops.join(', ')})`;

  const days: Array<{ at: number; label: string }> = [{ at: xMin, label: dayName(t0, 0, true) }];
  for (let d = 1; d < 4; d++) {
    const r = clockRel(t0, d, 0);
    if (r > xMin && r < xMax - 3) days.push({ at: r, label: dayName(t0, d, true) });
  }
  const hourTicks: Array<{ at: number; label: string; light: boolean }> = [];
  for (let d = 0; d < 4; d++) {
    for (const [hour, label, light] of [
      [6, '6am', false],
      [12, 'noon', true],
      [18, '6pm', true],
      [0, 'midnight', false],
    ] as const) {
      const r = clockRel(t0, d, hour);
      const nearMarker = Math.abs(r) < 2.5 || (view.nowH > xMin && view.nowH < xMax && Math.abs(r - view.nowH) < 2.5);
      if (r > xMin + 1.5 && r < xMax - 1.5 && !nearMarker) hourTicks.push({ at: r, label, light });
    }
  }

  const merged = mergeShifts(plan.shifts);
  const helpers = [...input.crew].sort((a, b) => (a.distance === 'far' ? 1 : 0) - (b.distance === 'far' ? 1 : 0));
  const needById = new Map(plan.needs.map((n) => [n.id, n]));
  const nowIn = view.nowH > xMin && view.nowH < xMax;

  const markerLines = (labels: boolean) => (
    <>
      <div className="marker" style={{ left: pct(0) }}>
        {labels && <span className="marker-label">Home</span>}
      </div>
      {nowIn && (
        <div className="marker now" style={{ left: pct(view.nowH) }}>
          {labels && <span className="marker-label">Now</span>}
        </div>
      )}
    </>
  );
  const markers = markerLines(false);

  // Spread out task dots that would sit on top of each other.
  const stagger = (xs: number[]) => {
    const out: number[] = [];
    let lastX = -Infinity;
    let k = 0;
    for (const x of xs) {
      k = x - lastX < span * 0.012 ? k + 1 : 0;
      out.push(k === 0 ? 0 : (k % 2 === 1 ? -1 : 1) * Math.ceil(k / 2) * 7);
      lastX = x;
    }
    return out;
  };

  return (
    <div className="runway">
      <div className="runway-scroll">
        <div className="runway-grid reveal">
          <div className="lane-label" style={{ minHeight: 30 }} />
          <div className="track track-days">
            {days.map((d) => (
              <span key={d.at} className="day-tick" style={{ left: pct(d.at) }}>
                {d.label}
              </span>
            ))}
          </div>

          <div className="lane-label" style={{ minHeight: 40 }}>
            Time
          </div>
          <div className="track sky">
            <div className="sky-fill" style={{ background: sky }} />
            {hourTicks.map((t) => (
              <span key={t.at} className={`hour-tick${t.light ? ' on-light' : ''}`} style={{ left: pct(t.at) }}>
                {t.label}
              </span>
            ))}
            {markerLines(true)}
          </div>

          <div className="lane-label">
            Events
            <small>visits, meals</small>
          </div>
          <div className="track">
            {plan.needs
              .filter((n) => n.pin === 'meal')
              .flatMap((n) =>
                (plan.assignments[n.id]?.parts ?? []).map((p) => (
                  <span
                    key={`${n.id}-${p.at}`}
                    className={`pin-meal${p.paid === 'benefit' ? ' benefit' : ''}`}
                    style={{ left: pct(p.at) }}
                    title={`${view.when(p.at)} meal: ${view.ownerLabel(p.owner)}`}
                  />
                )),
              )}
            {plan.needs
              .filter((n) => n.pin === 'visit')
              .map((n) => (
                <span
                  key={n.id}
                  tabIndex={0}
                  className="visit-window"
                  style={{ left: pct(n.window[0]), width: width(n.window[0], n.window[1]) }}
                  {...tipProps('Home health nurse visit', `Expected ${fmtRange(t0, n.window[0], n.window[1])}. Call the agency to pin down the time.`)}
                >
                  Nurse visit, time to confirm
                </span>
              ))}
            {plan.needs
              .filter((n) => n.pin && n.pin !== 'meal' && n.pin !== 'visit')
              .map((n) => {
                const at = n.pin === 'arrival' ? 0 : n.times?.[0] ?? n.window[1];
                const label = n.pin === 'arrival' ? 'Home' : n.pin === 'appointment' ? n.title.replace(/^Drive \w+ to /, '').replace(/ and stay.*$/, '') : 'Nurse visit';
                if (n.pin === 'arrival') return null;
                return (
                  <button
                    key={n.id}
                    className={`pin ${n.pin}`}
                    style={{ left: pct(at) }}
                    onClick={() => onPick(n.id)}
                    {...tipProps(n.title, n.pin === 'visit' ? `Expected by ${view.when(n.window[1])}` : view.when(at))}
                  >
                    {label}
                  </button>
                );
              })}
            {markers}
          </div>

          <div className="lane-label">
            Who’s there
            <small>
              {plan.coverage.required ? `${Math.round(plan.coverage.covered)} of ${plan.coverage.required}h covered` : 'No round-the-clock need'}
            </small>
          </div>
          <div className="track">
            {merged.map((s) => {
              if (s.memberId) {
                const name = view.name(s.memberId);
                return (
                  <span
                    key={s.start}
                    tabIndex={0}
                    className="bar"
                    style={{ left: pct(s.start), width: width(s.start, s.end), ['--c' as string]: view.color(s.memberId), ['--x' as string]: s.start - xMin } as CSSProperties}
                    {...tipProps(`${name} is there`, fmtRange(t0, s.start, s.end))}
                  >
                    {s.end - s.start >= 5 ? name : ''}
                  </span>
                );
              }
              const gap = plan.gaps.find((g) => g.start <= s.start + 1e-9 && g.end >= s.end - 1e-9);
              const booked = gap && view.gapBooked(gap.id);
              const provider = gap?.funding.provider?.name;
              return (
                <span
                  key={s.start}
                  tabIndex={0}
                  className={`bar ${booked ? 'paid' : 'gap'}`}
                  style={{ left: pct(s.start), width: width(s.start, s.end), ['--x' as string]: s.start - xMin } as CSSProperties}
                  {...tipProps(
                    booked ? `${provider ?? 'Paid help'} is there` : 'Nobody is there yet',
                    `${fmtRange(t0, s.start, s.end)}${!booked && provider ? `. Fix: ${provider}` : ''}${gap?.funding.unfillable ? '. Nothing can be booked this fast, so it needs family or a friend.' : ''}`,
                  )}
                >
                  {s.end - s.start >= 4 ? <span>{booked ? 'Booked' : 'Nobody'}</span> : ''}
                </span>
              );
            })}
            {markers}
          </div>

          {helpers.map((m) => {
            const mine = merged.filter((s) => s.memberId === m.id);
            const tasks = Object.values(plan.assignments).filter((a) => a.owner.kind === 'crew' && a.owner.memberId === m.id && !a.parts);
            const c = view.color(m.id);
            return [
              <div key={`${m.id}-l`} className="lane-label">
                <span>
                  <span className="swatch" style={{ background: c }} />
                  {m.name || 'Helper'}
                </span>
                <small>{m.distance === 'far' ? 'remote, by phone' : m.relation || (m.distance === 'home' ? 'lives there' : 'nearby')}</small>
              </div>,
              <div key={`${m.id}-t`} className="track" style={m.distance === 'far' ? { background: 'repeating-linear-gradient(90deg, transparent 0 6px, var(--line-2) 6px 7px)' } : undefined}>
                {mine.map((s) => (
                  <span
                    key={s.start}
                    className="bar"
                    style={{ left: pct(s.start), width: width(s.start, s.end), ['--c' as string]: `color-mix(in srgb, ${c} 28%, var(--paper))`, ['--x' as string]: s.start - xMin } as CSSProperties}
                    aria-hidden="true"
                  />
                ))}
                {(() => {
                  const sorted = [...tasks].sort((x, y) => x.at - y.at);
                  const offs = stagger(sorted.map((x) => x.at));
                  return sorted.map((a, i) => ({ a, dy: offs[i] }));
                })().map(({ a, dy }) => {
                  const n = needById.get(a.needId)!;
                  return (
                    <button
                      key={a.needId}
                      className="dot"
                      style={{ left: pct(a.at + Math.min(n.duration, 1) / 2), marginTop: -7 + dy, ['--c' as string]: c } as CSSProperties}
                      aria-label={`${n.title}, ${view.when(a.at)}`}
                      onClick={() => onPick(n.id)}
                      {...tipProps(n.title, `${view.when(a.at)}, ${m.name || 'Helper'}`)}
                    />
                  );
                })}
                {markers}
              </div>,
            ];
          })}

          <div className="lane-label">
            Paid help
            <small>and plan benefits</small>
          </div>
          <div className="track">
            {plan.gaps
              .filter((g) => g.funding.provider && view.gapBooked(g.id))
              .map((g) => (
                <span key={g.id} className="bar paid" style={{ left: pct(g.start), width: width(g.start, g.end), ['--x' as string]: g.start - xMin } as CSSProperties} aria-hidden="true">
                  {g.hours >= 5 ? 'Booked' : ''}
                </span>
              ))}
            {Object.values(plan.assignments)
              .filter((a) => a.owner.kind === 'service' && !a.parts)
              .map((a) => {
                const n = needById.get(a.needId)!;
                if (n.beyond) return null;
                return (
                  <button
                    key={a.needId}
                    className="dot service"
                    style={{ left: pct(a.at + Math.min(n.duration, 1) / 2) }}
                    aria-label={`${n.title}, ${view.when(a.at)}, ${view.ownerLabel(a.owner)}`}
                    onClick={() => onPick(n.id)}
                    {...tipProps(n.title, `${view.when(a.at)}, ${view.ownerLabel(a.owner)}`)}
                  />
                );
              })}
            {markers}
          </div>
        </div>
      </div>
      <div className="runway-legend">
        <span>
          <i className="legend-swatch" style={{ background: 'repeating-linear-gradient(135deg, var(--gap) 0 4px, var(--gap-soft) 4px 8px)' }} />
          Nobody there yet
        </span>
        <span>
          <i className="legend-swatch" style={{ background: 'repeating-linear-gradient(135deg, var(--paid) 0 4px, transparent 4px 8px)' }} />
          Paid help booked
        </span>
        <span>
          <i className="pin-meal" style={{ position: 'static', margin: 0 }} />
          Meal by family
        </span>
        <span>
          <i className="pin-meal benefit" style={{ position: 'static', margin: 0 }} />
          Meal from a benefit
        </span>
        <span>Dots are tasks. Select one to jump to it.</span>
      </div>
      {tip && (
        <div className="tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.title}</b>
          {tip.body}
        </div>
      )}
    </div>
  );
}
