export const taskViews = {
  my: "Мої", all: "Всі", today: "Сьогодні", overdue: "Прострочені",
  upcoming: "Майбутні", completed: "Виконані",
} as const;
export const workspaceTaskStatuses = ["Заплановано", "В роботі", "Виконано"] as const;
export const workspaceTaskPriorities = ["Терміновий", "Високий", "Середній", "Низький"] as const;
export type TaskView = keyof typeof taskViews;
export type TaskWorkspaceQuery = Record<string, string | string[] | undefined>;
export type TaskWorkspaceFilters = {
  view: TaskView; q: string; status: string; priority: string; assignee: string;
  target: string; source: string; recurrence: string;
};
export const TASK_WORKSPACE_PAGE_SIZE = 20;

export function taskWorkspaceEmptyMessage(filters: TaskWorkspaceFilters) {
  if (Object.entries(filters).some(([key, value]) => key !== "view" && Boolean(value))) return "За цими умовами завдань немає. Змініть пошук або очистіть фільтри.";
  switch (filters.view) {
    case "my": return "Вам ще не призначено завдань.";
    case "today": return "На сьогодні відкритих завдань немає.";
    case "overdue": return "Прострочених завдань немає.";
    case "upcoming": return "Майбутніх відкритих завдань поки немає.";
    case "completed": return "Завершених завдань поки немає.";
    default: return "Завдань поки немає.";
  }
}

export function taskQueryValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export function normalizeTaskWorkspace(query: TaskWorkspaceQuery) {
  const value = (key: string) => taskQueryValue(query[key]);
  const allowed = (key: string, values: readonly string[]) => values.includes(value(key)) ? value(key) : "";
  const assignee = value("assignee");
  const page = value("page");
  return {
    filters: {
      view: (allowed("view", Object.keys(taskViews)) || "all") as TaskView,
      q: value("q").trim().slice(0, 200),
      status: allowed("status", workspaceTaskStatuses),
      priority: allowed("priority", workspaceTaskPriorities),
      assignee: assignee === "unassigned" || (/^[1-9]\d*$/.test(assignee) && Number.isSafeInteger(Number(assignee))) ? assignee : "",
      target: allowed("target", ["object", "equipment"]),
      source: allowed("source", ["manual", "supervision", "equipment_maintenance"]),
      recurrence: allowed("recurrence", ["once", "recurring"]),
    } satisfies TaskWorkspaceFilters,
    page: /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page)) ? Number(page) : 1,
  };
}

export function taskWorkspaceHref(filters: TaskWorkspaceFilters, page = 1) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set("page", String(page));
  return `/tasks?${params}`;
}

/** Quote the PostgREST OR operand and treat user wildcard characters literally. */
export function taskSearchOperand(search: string) {
  const pattern = `%${search.replace(/[\\%_*]/g, "\\$&")}%`;
  return `"${pattern.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
