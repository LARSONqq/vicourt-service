import Link from "next/link";

export default function RegisterPage() {
  return <main className="flex min-h-dvh items-center justify-center bg-gray-100 p-4">
    <section className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-6">
      <p className="font-semibold text-green-800">ViCourt</p>
      <h1 className="text-2xl font-bold">Отримати доступ</h1>
      <p className="text-sm text-gray-600">Облікові записи створює адміністратор ViCourt. Зверніться до вашого менеджера або адміністратора.</p>
      <Link href="/login" className="inline-block min-h-11 rounded-lg bg-green-700 px-4 py-3 text-sm text-white">До входу</Link>
    </section>
  </main>;
}
