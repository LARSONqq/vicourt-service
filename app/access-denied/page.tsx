import { redirect } from "next/navigation";
import { getAccountIdentity } from "@/services/accountIdentityService";
import { accountHome } from "@/lib/auth/accountRouting";
import { logout } from "@/app/actions/sessionActions";

export default async function AccessDeniedPage() {
  const identity = await getAccountIdentity();
  if (identity !== "denied") redirect(accountHome(identity));
  return <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
    <section className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-6">
      <p className="font-semibold text-green-800">ViCourt</p>
      <h1 className="text-2xl font-bold">Доступ недоступний</h1>
      <p className="text-sm text-gray-600">Ваш обліковий запис поки не має активного доступу. Зверніться до адміністратора.</p>
      <form action={logout}><button className="min-h-11 rounded-lg border px-4 py-2">Вийти</button></form>
    </section>
  </main>;
}
