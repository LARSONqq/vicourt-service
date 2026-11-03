"use client";

export default function EquipmentError({ reset }: { reset: () => void }) {
  return <div role="alert" className="vc-surface p-6">
    <h2 className="vc-section-title">Не вдалося завантажити техніку</h2>
    <p className="mt-2 text-sm text-gray-600">Спробуйте ще раз. Дані техніки не змінено.</p>
    <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Повторити</button>
  </div>;
}
