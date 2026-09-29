export default function ClientLoading() {
  return <div role="status" aria-label="Завантаження кабінету" className="min-w-0 space-y-5">
    <p className="text-sm text-gray-600">Завантажуємо ваш кабінет…</p>
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      <div className="mb-5 h-8 w-2/3 rounded-lg bg-gray-200" />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {[1, 2].map((item) => <div key={item} className="space-y-4 rounded-2xl border bg-white p-5">
          <div className="h-5 w-1/3 rounded-full bg-gray-100" /><div className="h-6 w-4/5 rounded bg-gray-100" /><div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-11 rounded-lg bg-gray-100" />
        </div>)}
      </div>
    </div>
  </div>;
}
