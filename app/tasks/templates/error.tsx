"use client";
export default function TemplateError({ reset }: { reset: () => void }) {
  return <section role="alert" className="space-y-3 rounded-xl border bg-white p-6"><h2 className="font-semibold">Не вдалося відкрити шаблони</h2><p className="text-sm text-gray-500">Перевірте доступ і спробуйте ще раз.</p><button onClick={reset} className="rounded-lg border px-4 py-3">Спробувати ще раз</button></section>;
}
