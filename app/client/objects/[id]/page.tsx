import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientObject } from "@/services/clientPortalService";

export default async function ClientObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/u.test(id)) notFound();
  const object = await getClientObject(Number(id));
  return <>
    <Link href="/client" className="inline-block py-2 text-sm font-medium text-green-700">← Ваші об’єкти</Link>
    <section className="min-w-0 space-y-4 rounded-2xl border bg-white p-5 sm:p-8">
      <span className="inline-block rounded-full bg-green-50 px-3 py-1 text-sm text-green-800">{object.status}</span>
      <h1 className="break-words text-2xl font-bold sm:text-3xl">{object.name}</h1>
      <dl className="border-t pt-4"><dt className="text-sm text-gray-500">Адреса</dt><dd className="mt-1 break-words">{object.address || "Адресу не вказано"}</dd></dl>
    </section>
  </>;
}
