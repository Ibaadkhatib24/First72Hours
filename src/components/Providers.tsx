import type { ServiceKey } from '../engine';
import type { View } from '../ui/view';
import { Icon } from './Icon';

// Sample listings for the demo. The checks are the real product idea: a provider is only
// listed when these facts are verified, and the plan shows whether they can start in time.
const PROVIDERS: Array<{ id: string; name: string; what: string; services: ServiceKey[]; leadH: number; price: string; checks: string[] }> = [
  {
    id: 'hearth',
    name: 'Prairie Hearth Companions',
    what: 'Companion and homemaker care. 4-hour minimum.',
    services: ['companion', 'homemaker'],
    leadH: 24,
    price: '$32–$36 an hour',
    checks: ['State home care license', 'Background-checked caregivers', 'Insured and bonded', 'Takes employer backup care'],
  },
  {
    id: 'nightowl',
    name: 'Night Owl Overnight Care',
    what: 'Awake overnight companions so the family can sleep.',
    services: ['companion'],
    leadH: 12,
    price: '$28–$32 an hour',
    checks: ['State home care license', 'Background-checked caregivers', 'Fall-prevention training'],
  },
  {
    id: 'tworivers',
    name: 'Two Rivers Ride Assist',
    what: 'Door-through-door rides with a helper. Walkers and wheelchairs welcome.',
    services: ['ride', 'wheelchair-ride'],
    leadH: 24,
    price: '$45–$70 round trip',
    checks: ['Commercial insurance', 'Background-checked drivers', 'Waits during the visit'],
  },
  {
    id: 'juniper',
    name: 'Juniper Table Meals',
    what: 'Low-sodium and diabetic ready-to-heat meals.',
    services: ['meals'],
    leadH: 6,
    price: '$11–$13 a meal',
    checks: ['Dietitian-reviewed menus', 'Same-day delivery before 1pm orders', 'No subscription'],
  },
];

export function Providers({ view }: { view: View }) {
  const { plan } = view;
  // When each kind of help is first needed from outside the family.
  const firstNeed = (services: ServiceKey[]): { at: number; label: string } | undefined => {
    const out: Array<{ at: number; label: string }> = [];
    if (services.includes('companion')) for (const g of plan.gaps) out.push({ at: g.start, label: `the ${view.when(g.start)} gap` });
    for (const n of plan.needs) {
      const a = plan.assignments[n.id];
      if (!a || n.beyond || !n.service || !services.includes(n.service)) continue;
      if (a.owner.kind === 'service') out.push({ at: a.at, label: n.title.toLowerCase().startsWith('drive') ? `the ${view.when(a.at)} ride` : n.title });
      for (const p of a.parts ?? []) if (p.paid === 'delivery') out.push({ at: p.at, label: `the ${view.when(p.at)} meal` });
    }
    return out.sort((a, b) => a.at - b.at)[0];
  };

  return (
    <>
      <div className="providers">
        {PROVIDERS.map((p) => {
          const need = firstNeed(p.services);
          const ready = plan.plannedH + p.leadH;
          const key = `prov:${p.id}`;
          const asked = view.status[key] === 'asked' || view.status[key] === 'done';
          return (
            <article className="provider" key={p.id}>
              <h3>{p.name}</h3>
              <p className="what">{p.what}</p>
              <ul className="facts">
                {p.checks.map((c) => (
                  <li key={c}>
                    <Icon name="check" size={16} />
                    {c}
                  </li>
                ))}
              </ul>
              <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>
                {p.price}
              </span>
              {need ? (
                <span className={`fit${ready > need.at ? ' late' : ''}`}>
                  {ready > need.at ? `Can’t start until ${view.when(ready)}, too late for ${need.label}` : `Can start in time for ${need.label}`}
                </span>
              ) : (
                <span className="fit" style={{ background: 'var(--paper-2)', color: 'var(--ink-3)' }}>
                  Not needed in this plan
                </span>
              )}
              <button className="btn btn-small" aria-pressed={asked} onClick={() => view.setStatus(key, asked ? 'todo' : 'asked')}>
                <Icon name={asked ? 'check' : 'phone'} size={16} />
                {asked ? 'Marked as requested' : 'Mark as requested'}
              </button>
            </article>
          );
        })}
      </div>
      <p className="sample-note" style={{ marginTop: 12 }}>
        Sample listings for the demo. In a real deployment, providers appear only after the checks above are verified against state records, and each card shows whether they can start before the help is needed.
      </p>
    </>
  );
}
