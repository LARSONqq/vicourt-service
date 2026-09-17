export default function Loading() {
  return <div role="status" className="min-w-0 animate-pulse space-y-4"><p className="text-gray-500">Завантаження завдань…</p>{[1, 2, 3].map((id) => <div key={id} className="h-36 rounded-xl border bg-gray-50" />)}</div>;
}
