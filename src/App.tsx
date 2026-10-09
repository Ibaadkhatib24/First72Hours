import { useEffect, useMemo, useState } from 'react';
import { blankCase, planCase, sampleCase, sampleMedicareCase, type CaseInput, type Status } from './engine';
import { Intake } from './components/Intake';
import { PlanView } from './components/PlanView';
import { Start } from './components/Start';
import { clearSaved, loadInitial, persist, type AppState } from './state';

// Drop the plan tab (#helpers and so on) so a fresh plan opens on Home.
const clearTab = () => history.replaceState(null, '', location.pathname + location.search);

export function App() {
  const [state, setState] = useState<AppState>(loadInitial);

  useEffect(() => persist(state), [state]);

  // A shared link should not keep the plan in the address bar after it's loaded.
  useEffect(() => {
    if (location.hash.includes('plan=')) history.replaceState(null, '', location.pathname + location.search);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.screen, state.step]);

  const plan = useMemo(() => (state.input && state.screen === 'plan' ? planCase(state.input) : null), [state.input, state.screen]);

  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  if (state.screen === 'start' || !state.input) {
    return (
      <Start
        onDemo={(kind: 'uninsured' | 'medicare') =>
          update({ screen: 'plan', input: kind === 'medicare' ? sampleMedicareCase() : sampleCase(), status: {}, demo: true, me: undefined })
        }
        onNew={() => update({ screen: 'intake', step: 0, input: blankCase(), status: {}, demo: false, me: undefined })}
      />
    );
  }

  if (state.screen === 'intake') {
    return (
      <Intake
        input={state.input}
        step={state.step}
        onChange={(input: CaseInput) => update({ input })}
        onStep={(step: number) => update({ step })}
        onDone={() => update({ screen: 'plan' })}
        onExit={() => update({ screen: state.input?.papers ? 'plan' : 'start' })}
      />
    );
  }

  return (
    <PlanView
      plan={plan!}
      input={state.input}
      status={state.status}
      me={state.me}
      demo={!!state.demo}
      onStatus={(id: string, s: Status) => update({ status: { ...state.status, [id]: s } })}
      onInput={(input: CaseInput) => update({ input })}
      onEdit={(step = 0) => update({ screen: 'intake', step, me: undefined })}
      onClearMe={() => update({ me: undefined })}
      onReset={() => {
        clearSaved();
        clearTab();
        setState({ screen: 'start', step: 0, input: null, status: {} });
      }}
      onNew={() => {
        clearSaved();
        clearTab();
        setState({ screen: 'intake', step: 0, input: blankCase(), status: {}, demo: false });
      }}
    />
  );
}
