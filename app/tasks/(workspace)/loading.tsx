export default function TaskWorkspaceLoading() {
  return <div role="status" aria-label="Завантаження списку завдань" className="vc-task-panel min-w-0 animate-pulse space-y-4 motion-reduce:animate-none">
    <div className="h-11 rounded-lg border border-border bg-muted/60" />
    {[1, 2, 3].map((id) => <div key={id} className="vc-surface h-36 bg-muted/70" />)}
    <span className="sr-only">Завантаження списку завдань…</span>
  </div>;
}
