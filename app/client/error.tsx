"use client";
export default function ClientError({ reset }: { reset: () => void }) {
  return <section className="space-y-3 rounded-xl border bg-white p-5" role="alert">
    <h2 className="font-semibold">Не вдалося завантажити дані</h2>
    <p className="text-sm text-gray-500">Перевірте з’єднання або спробуйте пізніше.</p>
    <button onClick={reset} className="min-h-11 rounded-lg border px-4 py-2">Спробувати ще раз</button>
  </section>;
}
