import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { clientPage } from "@/lib/clientPortal";
import { getAdminClients, getAdminObjectClients } from "@/services/clientAccessService";
import { getObject } from "@/services/objectService";
import CreateAccountForm from "@/components/users/CreateAccountForm";
import ClientAccessManager from "@/components/users/ClientAccessManager";

export default async function ClientManagementPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; object?: string; grantPage?: string }> }) {
  await requireSectionAccess("users");
  const query = await searchParams;
  const page = clientPage(query.page);
  const grantPage = clientPage(query.grantPage);
  const search = typeof query.q === "string" ? query.q.slice(0, 120) : "";
  let object: { id: number; name: string } | undefined;
  if (query.object) {
    const id = Number(query.object);
    if (!/^\d+$/u.test(query.object) || !Number.isSafeInteger(id) || id <= 0) notFound();
    const row = await getObject(id);
    if (!row) notFound();
    object = { id: row.id, name: row.name };
  }
  const [clients, grants] = await Promise.all([getAdminClients(search, page), object ? getAdminObjectClients(object.id, grantPage) : Promise.resolve({ items: [], hasMore: false })]);
  const href = (nextPage: number, nextGrantPage = grantPage) => {
    const params = new URLSearchParams({ page: String(nextPage), grantPage: String(nextGrantPage) });
    if (search) params.set("q", search);
    if (object) params.set("object", String(object.id));
    return `/users/clients?${params}`;
  };
  return <div className="min-w-0 space-y-5">
    <Link className="text-sm text-green-700" href={object ? `/objects/${object.id}` : "/users"}>← {object ? "До об’єкта" : "Користувачі"}</Link>
    <h1 className="text-2xl font-bold">Доступ клієнтів</h1>
    <CreateAccountForm kind="client" />
    <form className="flex flex-wrap gap-2" action="/users/clients">
      {object && <input type="hidden" name="object" value={object.id} />}
      <input aria-label="Пошук клієнтів за іменем" name="q" defaultValue={search} placeholder="Ім’я клієнта" maxLength={120} className="min-h-11 min-w-0 flex-1 rounded-lg border px-3" />
      <button className="min-h-11 rounded-lg border bg-white px-4">Знайти</button>
    </form>
    <ClientAccessManager key={object?.id ?? "directory"} clients={clients.items} grants={grants.items} object={object} />
    <nav aria-label="Сторінки клієнтів" className="flex flex-wrap gap-4 text-sm text-green-700">
      {page > 1 && <Link href={href(page - 1)}>← Попередні клієнти</Link>}
      {clients.hasMore && <Link href={href(page + 1)}>Наступні клієнти →</Link>}
    </nav>
    {object && <nav aria-label="Сторінки дозволів" className="flex flex-wrap gap-4 text-sm text-green-700">
      {grantPage > 1 && <Link href={href(page, grantPage - 1)}>← Попередні дозволи</Link>}
      {grants.hasMore && <Link href={href(page, grantPage + 1)}>Наступні дозволи →</Link>}
    </nav>}
  </div>;
}
