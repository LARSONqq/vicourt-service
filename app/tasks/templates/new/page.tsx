import Link from "next/link";
import TaskTemplatesPanel from "@/components/tasks/TaskTemplatesPanel";
import { requireTemplateManagement } from "@/services/taskTemplateService";

export default async function NewTemplatePage() {
  await requireTemplateManagement();
  return <div className="min-w-0 space-y-5"><Link href="/tasks/templates" className="inline-block py-2 text-sm text-green-700">← До шаблонів</Link><h1 className="text-2xl font-bold">Створити шаблон / серію</h1><TaskTemplatesPanel /></div>;
}
