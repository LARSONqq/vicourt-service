import Link from "next/link";
import TaskTemplatesPanel from "@/components/tasks/TaskTemplatesPanel";
import { requireTemplateManagement } from "@/services/taskTemplateService";
import { recurringTaskCopy } from "@/lib/taskTemplateWorkspace";

export default async function NewTemplatePage() {
  await requireTemplateManagement();
  return <div className="vc-task-panel min-w-0 space-y-5"><Link href="/tasks/templates" className="inline-block py-2 text-sm font-medium text-primary hover:underline">← {recurringTaskCopy.title}</Link><h1 className="vc-page-title">{recurringTaskCopy.create}</h1><TaskTemplatesPanel /></div>;
}
