import { redirect } from "next/navigation";

import { normalizeTaskWorkspace, taskWorkspaceHref, type TaskWorkspaceQuery } from "@/lib/taskWorkspace";

// Preserve existing links/bookmarks while using the canonical workspace.
export default async function LegacyTaskPage({ searchParams }: { searchParams: Promise<TaskWorkspaceQuery> }) {
  const { filters, page } = normalizeTaskWorkspace(await searchParams);
  redirect(taskWorkspaceHref(filters, page));
}
