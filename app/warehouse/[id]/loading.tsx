export default function WarehouseItemLoading() {
  return (
    <main role="status" aria-label="Завантаження матеріалу" className="mx-auto w-full max-w-7xl space-y-5 p-4">
      <div className="h-10 w-40 animate-pulse motion-reduce:animate-none rounded-lg bg-gray-200" />
      <div className="h-44 animate-pulse motion-reduce:animate-none rounded-lg border border-border bg-card" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-72 animate-pulse motion-reduce:animate-none rounded-lg border border-border bg-card" />
        <div className="h-72 animate-pulse motion-reduce:animate-none rounded-lg border border-border bg-card" />
      </div>
      <div className="h-80 animate-pulse motion-reduce:animate-none rounded-lg border border-border bg-card" />
    </main>
  );
}
