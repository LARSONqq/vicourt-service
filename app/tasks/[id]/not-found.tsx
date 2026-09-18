import Link from "next/link";

export default function TaskNotFound() {
  return <section className="rounded-xl border bg-white p-6"><h1 className="text-xl font-semibold">Завдання не знайдено</h1><p className="mt-2 text-sm text-gray-600">Запис відсутній або недоступний.</p><Link href="/tasks" className="mt-4 inline-block py-2 text-green-700 hover:underline">← До завдань</Link></section>;
}
