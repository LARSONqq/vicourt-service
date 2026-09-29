import Link from "next/link";
import { requireClientAccess } from "@/services/clientPortalService";
import { logout } from "@/app/actions/sessionActions";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireClientAccess();
  return <div className="min-h-dvh min-w-0 bg-gray-50 text-gray-900">
    <a href="#client-main" className="sr-only z-50 rounded-lg bg-green-800 p-3 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">До вмісту</a>
    <header className="border-b bg-white">
      <nav aria-label="Кабінет клієнта" className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/client" className="min-w-0 rounded-lg text-xl font-bold tracking-tight text-green-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green-700">ViCourt <span className="block text-xs font-normal tracking-normal text-gray-500">Кабінет клієнта</span></Link>
        <form action={logout} className="shrink-0"><button className="min-h-11 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700">Вийти</button></form>
      </nav>
    </header>
    <main id="client-main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-4xl space-y-5 px-4 py-6 [overflow-wrap:anywhere] sm:space-y-6 sm:px-6 sm:py-8">{children}</main>
  </div>;
}
