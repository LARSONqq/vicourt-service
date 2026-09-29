"use client";
import ClientPortalState from "@/components/client/ClientPortalState";

export default function ClientError({ reset }: { reset: () => void }) {
  return <section className="min-w-0 rounded-2xl border bg-white p-5 sm:p-8" aria-label="Не вдалося завантажити дані">
    <ClientPortalState error title="Не вдалося завантажити дані" description="Перевірте з’єднання або спробуйте пізніше.">
      <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-green-800 px-4 py-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">Спробувати ще раз</button>
    </ClientPortalState>
  </section>;
}
