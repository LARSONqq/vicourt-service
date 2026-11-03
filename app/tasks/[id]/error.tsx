"use client";

export default function TaskDetailError({ reset }: { reset: () => void }) {
  return <section role="alert" className="vc-surface p-6"><h2 className="vc-section-title">Не вдалося завантажити завдання</h2><p className="mt-2 text-sm text-muted-foreground">Перевірте з’єднання та спробуйте ще раз.</p><button onClick={reset} className="mt-4 min-h-11 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">Повторити</button></section>;
}
