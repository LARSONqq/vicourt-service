export default function WarehouseItemLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200" />
      <div className="h-44 animate-pulse rounded-2xl border bg-white" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-xl border bg-white" />
        <div className="h-72 animate-pulse rounded-xl border bg-white" />
      </div>
      <div className="h-80 animate-pulse rounded-xl border bg-white" />
    </main>
  );
}
