import { useEffect } from 'react';
import type { TabId } from '../engine';
import type { View } from '../ui/view';
import { Icon } from './Icon';

type IconName = Parameters<typeof Icon>[0]['name'];

export const TABS: Array<{ id: TabId; label: string; icon: IconName; title: string; blurb: string }> = [
  { id: 'home', label: 'Home', icon: 'home', title: 'Home', blurb: '' },
  { id: 'ask', label: 'Ask', icon: 'message', title: 'Ask a question', blurb: 'Ask about {name}’s plan in your own words, by typing or speaking.' },
  { id: 'alerts', label: 'Heads up', icon: 'alert', title: 'Heads up', blurb: 'Things that could go wrong in the first 72 hours, and what to do about each one.' },
  { id: 'schedule', label: 'Schedule', icon: 'clock', title: 'Schedule', blurb: 'Who is with {name} each hour, and when nobody is there yet.' },
  { id: 'todo', label: 'To-do', icon: 'list', title: 'To-do list', blurb: 'Every task, who does it and when. Each one shows the line in the papers that created it.' },
  { id: 'money', label: 'Money', icon: 'money', title: 'Money', blurb: 'What the next 72 hours cost, what’s covered, and the calls to make.' },
  { id: 'coverage', label: 'Health coverage', icon: 'coverage', title: 'Health coverage', blurb: 'Clinics, the hospital bill, food help and insurance {name} may qualify for.' },
  { id: 'helpers', label: 'Helpers', icon: 'coordination', title: 'Helpers', blurb: 'Each person’s shifts and tasks. Send everyone just their part.' },
  { id: 'hire', label: 'Hire help', icon: 'providers', title: 'Hire help', blurb: 'Paid help that’s checked, priced, and able to start in time.' },
  { id: 'later', label: 'Next week', icon: 'week', title: 'Start now for next week', blurb: 'These take days to set up. Start them today so they’re ready when the 72 hours end.' },
];

export const isTab = (s: string): s is TabId => TABS.some((t) => t.id === s);

export function badgeFor(view: View, id: TabId): { text: string; urgent?: boolean } | undefined {
  const { plan, heads, status } = view;
  if (id === 'alerts') {
    const now = heads.flags.filter((f) => !f.resolved && f.level === 'now').length;
    return heads.open ? { text: String(heads.open), urgent: now > 0 } : undefined;
  }
  if (id === 'schedule') {
    const open = plan.gaps.filter((g) => !view.gapBooked(g.id)).length;
    return open ? { text: String(open), urgent: true } : undefined;
  }
  if (id === 'todo') {
    const left = plan.needs.filter((n) => !n.presence && status[n.id] !== 'done').length;
    return left ? { text: String(left) } : undefined;
  }
  return undefined;
}

export function TabBar({ view, tab }: { view: View; tab: TabId }) {
  // On narrow screens the tab row scrolls, so keep the open tab in view.
  useEffect(() => {
    document.querySelector('.tabs .tab[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);
  return (
    <nav className="tabs" aria-label="Plan sections">
      <div className="shell tabs-inner">
        {TABS.map((t) => {
          const badge = badgeFor(view, t.id);
          return (
            <a key={t.id} href={`#${t.id}`} className="tab" aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={20} />
              <span>{t.label}</span>
              {badge && (
                <span className={`badge${badge.urgent ? ' urgent' : ''}`} aria-label={`${badge.text} open`}>
                  {badge.text}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

export function PageHead({ tab, view }: { tab: TabId; view: View }) {
  const t = TABS.find((x) => x.id === tab)!;
  return (
    <div className="page-head">
      <a href="#home" className="back">
        <Icon name="back" size={18} />
        Home
      </a>
      <h1>{t.title}</h1>
      <p>{t.blurb.replace(/\{name\}/g, view.patientName)}</p>
    </div>
  );
}
