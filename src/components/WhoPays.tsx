import { mid, niceDeadline, sourceById, type Call } from '../engine';
import { about, moneyRange } from '../ui/format';
import type { View } from '../ui/view';
import { Icon } from './Icon';
import { Script } from './Script';
import { StatusControl } from './Status';

const CALL_LABELS = { todo: 'To call', asked: 'Called', done: 'Set up' };

function CallCard({ call, view }: { call: Call; view: View }) {
  const { plan } = view;
  const need = plan.needs.find((n) => n.id === call.needId) ?? plan.needs[0];
  const key = `call:${call.sourceId}`;
  const status = view.status[key] ?? 'todo';
  const urgent = call.status !== 'later' && call.deadline <= view.nowH + 1;
  const verb = call.kind === 'community' ? 'Ask' : 'Call';
  const whenText = call.status === 'later' ? 'Start this week' : urgent ? `${verb} now` : `${verb} by ${view.when(niceDeadline(call.deadline, plan.t0))}`;
  const tag =
    call.status === 'counted' ? (
      <>
        Counted in the plan: <b className="num">{moneyRange(call.value)}</b>
      </>
    ) : call.status === 'ask' ? (
      call.kind === 'community'
        ? 'Free if people say yes. Worth asking.'
        : call.kind === 'insurance' && call.eligibility === 'maybe'
          ? 'Some plans include this. Worth asking.'
          : call.eligibility === 'maybe'
            ? 'Varies, but often yes. Worth asking.'
            : 'Worth asking.'
    ) : (
      'Too slow for this week. Start it now for next week.'
    );
  const lead = Math.round((sourceById(call.sourceId).readyAt(plan.ctx) - plan.plannedH) / 24);

  return (
    <li className={`call ${call.status}`}>
      <div className="call-top">
        <span className="call-name">{call.name}</span>
        <span className={`call-when num${urgent && status !== 'done' ? ' urgent' : ''}${call.status === 'later' ? ' later' : ''}`}>{status === 'done' ? 'Done' : whenText}</span>
      </div>
      <span className="call-tag">{tag}</span>
      {call.covers.length > 0 && <span className="call-covers">For: {call.covers.join('; ')}</span>}
      {call.tooSlowFor.length > 0 && call.status !== 'later' && (
        <span className="call-slow">
          <Icon name="clock" size={14} />
          <span>
            Too slow for {call.tooSlowFor.join('; ')}
            {lead >= 1 ? `. It needs about ${lead} ${lead === 1 ? 'day' : 'days'}’ notice.` : '.'}
          </span>
        </span>
      )}
      <details>
        <summary className="link" style={{ textDecoration: 'none', fontSize: 14 }}>
          What to say
        </summary>
        <div style={{ marginTop: 8 }}>
          <Script sourceId={call.sourceId} ctx={plan.ctx} need={need} at={call.at} />
        </div>
      </details>
      <StatusControl value={status} onChange={(s) => view.setStatus(key, s)} labels={CALL_LABELS} label={`Status of call to ${call.name}`} />
    </li>
  );
}


export function WhoPays({ view }: { view: View }) {
  const { plan, input } = view;
  const t = plan.totals;
  const benefits = mid(t.benefits);
  const family = mid(t.youPay);
  const total = Math.max(1, benefits + family);
  const chippers = input.crew.filter((m) => m.chipIn);
  const calls = plan.calls;
  const counted = calls.filter((c) => c.status === 'counted');
  const uninsured = plan.screening.uninsured;

  return (
    <div className="pays">
      <h2>Who pays</h2>
      <div className="money-row">
        <div className="good">
          <b className="num">{about(t.benefits)}</b>
          <span>{uninsured ? 'covered by free help' : 'covered by benefits the family already has'}</span>
        </div>
        <div>
          <b className="num">{about(t.youPay)}</b>
          <span>{uninsured ? 'family cost for 72 hours' : 'family share for 72 hours'}</span>
        </div>
      </div>
      <div className="stack" role="img" aria-label={`Benefits ${about(t.benefits)}, family ${about(t.youPay)}`}>
        <span className="s-good" style={{ width: `${(benefits / total) * 100}%` }} />
        <span className="s-family" style={{ width: `${(family / total) * 100}%` }} />
      </div>
      <p className="pays-note">
        Estimated range {moneyRange(t.youPay)} for the family.
        {chippers.length > 1 && (
          <>
            {' '}
            Split {chippers.length} ways ({chippers.map((m) => m.name).join(', ')}): about {about(t.perChipIn)} each.
          </>
        )}
        {t.hsaEligible.high > 0 && <> {moneyRange(t.hsaEligible)} of it can come from an HSA or FSA.</>}
      </p>
      {uninsured && (
        <p className="early good">
          <Icon name="coverage" size={18} />
          <span>
            The hospital bill is the big one. <a href="#coverage">Health coverage</a> shows the financial assistance, clinic and food programs {view.patientName} likely qualifies for.
          </span>
        </p>
      )}
      {plan.earlyBonus >= 10 && (
        <p className="early">
          <Icon name="clock" size={18} />
          <span>
            Starting this plan two days before discharge would unlock about <b>${Math.round(plan.earlyBonus / 10) * 10}</b> more, because some benefits need days of notice.
          </span>
        </p>
      )}

      <div className="calls-head">
        <h3>Calls to make</h3>
        <span className="call-tag">
          {counted.length} counted, {calls.length - counted.length} more to try
        </span>
      </div>
      <ol className="calls">
        {calls.map((c) => (
          <CallCard key={c.sourceId} call={c} view={view} />
        ))}
      </ol>
    </div>
  );
}
