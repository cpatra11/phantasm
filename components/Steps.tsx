export type StepView = {
  id: string;
  label: string;
  status: 'running' | 'done' | 'error';
  detail?: string;
};

/** Live agent progress. Each step shows a filled (done), accent (running), or red (error) mark. */
export function Steps({ steps }: { steps: StepView[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="steps" aria-label="Agent progress">
      {steps.map((s) => (
        <li key={s.id} data-status={s.status}>
          <span className="mark-state" aria-hidden="true" />
          <span>
            {s.label}
            <span className="muted">{s.status === 'running' ? ' — working' : s.status === 'done' ? ' — done' : ' — failed'}</span>
            {s.detail && <span className="muted"> · {s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
