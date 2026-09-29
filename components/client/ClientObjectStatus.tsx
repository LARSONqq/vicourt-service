const colors: Record<string, string> = {
  "Новий": "bg-sky-50 text-sky-800 ring-sky-100",
  "В роботі": "bg-amber-50 text-amber-800 ring-amber-100",
  "Завершено": "bg-green-50 text-green-800 ring-green-100",
  "На постійному обслуговуванні": "bg-green-50 text-green-800 ring-green-100",
  "Під періодичним наглядом": "bg-teal-50 text-teal-800 ring-teal-100",
  "Призупинено": "bg-gray-100 text-gray-700 ring-gray-200",
};

export default function ClientObjectStatus({ status }: { status: string }) {
  return <span className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset [overflow-wrap:anywhere] ${Object.hasOwn(colors, status) ? colors[status] : "bg-gray-100 text-gray-700 ring-gray-200"}`}>
    <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{status}
  </span>;
}
