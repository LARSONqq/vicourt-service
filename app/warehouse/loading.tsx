export default function WarehouseLoading() {
  return <div role="status" aria-label="Завантаження складу" className="min-w-0 animate-pulse space-y-4 motion-reduce:animate-none">
    <div className="h-8 w-40 rounded bg-gray-200" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((id) => <div key={id} className="vc-surface h-24 bg-gray-50/70" />)}</div>
    <div className="vc-surface h-24 bg-gray-50/70" />
    <div className="vc-surface h-72 bg-gray-50/70" />
    <span className="sr-only">Завантаження складу…</span>
  </div>;
}
