import Link from "next/link";
export default function TemplateNotFound() {
  return <section className="space-y-3 rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Серію або шаблон не знайдено</h1><p className="text-sm text-gray-500">Запис видалено або він недоступний.</p><Link href="/tasks/templates" className="inline-block py-2 text-green-700">До повторюваних задач</Link></section>;
}
