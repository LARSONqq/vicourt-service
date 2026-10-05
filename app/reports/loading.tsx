export default function ReportsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Завантаження звітів"
      className="min-w-0 space-y-5 sm:space-y-6"
    >
      <div className="space-y-2">
        <div className="h-8 w-36 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-full max-w-xl animate-pulse rounded bg-gray-100" />
      </div>

      <div className="h-72 animate-pulse rounded-xl border bg-white" />
      <div className="h-14 animate-pulse rounded-xl border bg-white" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({
          length: 6,
        }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border bg-white"
          />
        ))}
      </div>
    </div>
  );
}
