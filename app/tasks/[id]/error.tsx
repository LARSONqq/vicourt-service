"use client";

export default function TaskDetailError({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-xl border bg-white p-6"><h2 className="font-semibold">Не вдалося завантажити завдання</h2><p className="mt-2 text-sm text-gray-600">Перевірте з’єднання та спробуйте ще раз.</p><button onClick={reset} className="mt-4 min-h-11 rounded-lg bg-green-700 px-4 py-2 text-white">Повторити</button></section>;
}
