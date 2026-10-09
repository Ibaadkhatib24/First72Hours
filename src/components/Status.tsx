import type { Status } from '../engine';

const DEFAULT: Record<Status, string> = { todo: 'To do', asked: 'Asked', done: 'Done' };

export function StatusControl({
  value,
  onChange,
  labels = DEFAULT,
  label,
}: {
  value: Status;
  onChange: (s: Status) => void;
  labels?: Record<Status, string>;
  label: string;
}) {
  return (
    <div className="status" role="group" aria-label={label}>
      {(['todo', 'asked', 'done'] as Status[]).map((s) => (
        <button key={s} aria-pressed={value === s} onClick={() => onChange(s)}>
          {labels[s]}
        </button>
      ))}
    </div>
  );
}
