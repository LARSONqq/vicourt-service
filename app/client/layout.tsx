import Link from "next/link";
import { requireClientAccess } from "@/services/clientPortalService";
import { logout } from "@/app/actions/sessionActions";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireClientAccess();
  return <div className="min-h-dvh bg-gray-50">
    <header className="border-b bg-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/client" className="min-w-0 font-bold text-green-800">ViCourt <span className="block text-xs font-normal text-gray-500">Кабінет клієнта</span></Link>
        <form action={logout}><button className="min-h-11 rounded-lg border px-4 py-2 text-sm">Вийти</button></form>
      </nav>
    </header>
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:py-8">{children}</main>
  </div>;
}
