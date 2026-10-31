"use client";

export default function WarehouseError({ reset }: { reset: () => void }) {
  return <div role="alert" className="vc-surface p-6">
    <h2 className="vc-section-title">Не вдалося завантажити склад</h2>
    <p className="mt-2 text-sm text-gray-600">Спробуйте ще раз. Дані складу не змінено.</p>
    <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-lg bg-green-700 px-4 py-3 font-medium text-white shadow-sm hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">Повторити</button>
  </div>;
}
