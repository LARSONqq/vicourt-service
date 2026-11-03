"use client";
export default function TemplateError({ reset }: { reset: () => void }) {
  return <section role="alert" className="vc-surface space-y-3 p-6"><h2 className="vc-section-title">Не вдалося відкрити повторювані задачі</h2><p className="text-sm text-muted-foreground">Перевірте доступ і спробуйте ще раз.</p><button type="button" onClick={reset} className="min-h-11 rounded-md border border-border bg-card px-4 py-3 hover:bg-muted">Спробувати ще раз</button></section>;
}
