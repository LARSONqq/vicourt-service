import Link from "next/link";
import ClientPortalState from "@/components/client/ClientPortalState";

export default function ClientNotFound() {
  return <section className="min-w-0 rounded-2xl border bg-white p-5 sm:p-8">
    <ClientPortalState title="Сторінка недоступна" description="Поверніться до ваших об’єктів або зверніться до менеджера, якщо очікуєте доступ.">
      <Link href="/client" className="inline-flex min-h-11 items-center rounded-lg bg-green-800 px-4 py-3 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">До ваших об’єктів</Link>
    </ClientPortalState>
  </section>;
}
