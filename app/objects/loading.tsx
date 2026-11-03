export default function ObjectsLoading() {
  return <div role="status" aria-label="Завантаження об’єктів" className="min-w-0 animate-pulse space-y-4 motion-reduce:animate-none">
    <div className="h-8 w-48 rounded bg-muted" />
    <div className="vc-surface h-20 bg-muted/60" />
    {[1, 2, 3].map((id) => <div key={id} className="vc-surface h-32 bg-muted/60" />)}
    <span className="sr-only">Завантаження об’єктів…</span>
  </div>;
}
