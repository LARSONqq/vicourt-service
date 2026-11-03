export default function Loading() {
  return <div role="status" aria-label="Завантаження завдань" className="min-w-0 animate-pulse space-y-4 motion-reduce:animate-none"><div className="h-8 w-48 rounded bg-muted" />{[1, 2, 3].map((id) => <div key={id} className="vc-surface h-36 bg-muted/70" />)}<span className="sr-only">Завантаження завдань…</span></div>;
}
