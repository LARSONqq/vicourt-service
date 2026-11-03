import Link from "next/link";
export default function TemplateNotFound() {
  return <section className="vc-surface space-y-3 p-6"><h1 className="vc-section-title">Серію або шаблон не знайдено</h1><p className="text-sm text-muted-foreground">Запис видалено або він недоступний.</p><Link href="/tasks/templates" className="inline-block py-2 text-primary hover:underline">До повторюваних задач</Link></section>;
}
