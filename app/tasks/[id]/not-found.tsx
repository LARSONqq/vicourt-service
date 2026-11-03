import Link from "next/link";

export default function TaskNotFound() {
  return <section className="vc-surface p-6"><h1 className="vc-section-title">Завдання не знайдено</h1><p className="mt-2 text-sm text-muted-foreground">Запис відсутній або недоступний.</p><Link href="/tasks" className="mt-4 inline-block py-2 text-primary hover:underline">← До завдань</Link></section>;
}
