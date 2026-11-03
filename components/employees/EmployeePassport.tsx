import Link from "next/link";

import ActivityTimelineList from "@/components/activity/ActivityTimelineList";
import { EmployeeTabPagination } from "@/components/employees/EmployeePassportNavigation";
import EquipmentWorkSessionList from "@/components/equipment/EquipmentWorkSessionList";
import RecurringTaskBadge from "@/components/tasks/RecurringTaskBadge";
import {
  evaluateEquipmentMaintenance,
  getEquipmentMaintenanceOverallKind,
  getEquipmentMaintenanceOverallLabel,
} from "@/lib/equipmentMaintenance";
import { formatDateValue } from "@/lib/kyivDate";
import { getObjectSupervisionState } from "@/lib/objectSupervision";

import type { ActivityLog } from "@/types/activityLog";
import type { EmployeeDetails } from "@/types/employee";
import type {
  EmployeeActivityPage,
  EmployeeActor,
  EmployeeEquipmentPage,
  EmployeeObjectPage,
  EmployeeProfileKpis,
  EmployeeSupervisionPreview,
  EmployeeTaskPage,
  EmployeeWorkLogPage,
} from "@/types/employeeProfile";
import type { Equipment } from "@/types/equipment";
import type {
  EquipmentWorkSessionPage,
} from "@/types/equipmentUsage";
import type { ObjectItem } from "@/types/object";
import type { TaskWithObject } from "@/types/taskWithObject";

function formatDate(value: string | null) {
  return formatDateValue(value) || "Не вказано";
}

function formatHours(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRate(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    maximumFractionDigits: 2,
  }).format(value);
}

function getTaskStatusClasses(status: string) {
  switch (status) {
    case "Заплановано":
      return "vc-status-info";
    case "В роботі":
      return "vc-status-warning";
    case "Виконано":
      return "vc-status-success";
    default:
      return "vc-status-neutral";
  }
}

function getPriorityClasses(priority: string) {
  switch (priority) {
    case "Терміновий":
      return "vc-status-danger";
    case "Високий":
      return "vc-status-warning";
    case "Середній":
      return "vc-status-info";
    default:
      return "vc-status-neutral";
  }
}

function getTaskSourceLabel(task: TaskWithObject) {
  switch (task.task_source) {
    case "supervision":
      return "Періодичний огляд";
    case "equipment_maintenance":
      return "ТО техніки";
    default:
      return "Ручне завдання";
  }
}

function getSupervisionLabel(
  object: Pick<ObjectItem, "next_supervision_date">,
  today: string
) {
  const state = getObjectSupervisionState(
    object.next_supervision_date,
    today
  );

  switch (state.kind) {
    case "today":
      return "Огляд сьогодні";
    case "overdue":
      return `Огляд прострочено на ${state.overdueDays} дн.`;
    case "planned":
      return `Наступний огляд: ${formatDate(object.next_supervision_date)}`;
    default:
      return "Огляд не заплановано";
  }
}

function getSupervisionClasses(
  object: Pick<ObjectItem, "next_supervision_date">,
  today: string
) {
  const state = getObjectSupervisionState(
    object.next_supervision_date,
    today
  );

  if (state.kind === "overdue") {
    return "vc-status-danger";
  }
  if (state.kind === "today") {
    return "vc-status-warning";
  }
  if (state.kind === "planned") {
    return "vc-status-info";
  }
  return "vc-status-neutral";
}

function getMaintenanceClasses(equipment: Equipment, today: string) {
  const evaluation = evaluateEquipmentMaintenance(equipment, today);
  const kind = getEquipmentMaintenanceOverallKind(evaluation);

  if (kind === "overdue") {
    return "vc-status-danger";
  }
  if (kind === "due" || kind === "today") {
    return "vc-status-warning";
  }
  if (kind === "scheduled") {
    return "vc-status-info";
  }
  return "vc-status-neutral";
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="vc-surface border-dashed p-6 text-center shadow-none">
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-foreground">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

function TaskCards({
  tasks,
  compact = false,
}: {
  tasks: TaskWithObject[];
  compact?: boolean;
}) {
  if (tasks.length === 0) {
    return <EmptyState title="Завдань немає" />;
  }

  return (
    <div
      className={`grid min-w-0 grid-cols-1 gap-3 ${
        compact ? "" : "xl:grid-cols-2"
      }`}
    >
      {tasks.map((task) => (
        <article
          key={task.id}
          className="vc-surface min-w-0 p-4"
        >
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="break-words font-semibold text-foreground">
                {task.title}
              </h3>
              <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {getTaskSourceLabel(task)}
                </span>
                {task.task_template_id !== null && (
                  <RecurringTaskBadge compact />
                )}
              </div>
            </div>
            <span
              className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getTaskStatusClasses(
                task.status
              )}`}
            >
              {task.status}
            </span>
          </div>

          {task.description && !compact && (
            <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-muted-foreground">
              {task.description}
            </p>
          )}

          <div className="mt-4 flex min-w-0 flex-col gap-1.5 border-t pt-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
            <p className="text-muted-foreground">
              Термін:{" "}
              <span className="font-medium text-foreground">
                {formatDate(task.due_date)}
              </span>
            </p>
            {task.object ? (
              <Link
                href={`/objects/${task.object.id}`}
                className="w-fit break-words font-medium text-[var(--vc-success-text)] hover:underline"
              >
                {task.object.name}
              </Link>
            ) : task.equipment ? (
              <Link
                href="/equipment"
                className="w-fit break-words font-medium text-[var(--vc-success-text)] hover:underline"
              >
                {task.equipment.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Ціль не вказано</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function WorkLogCards({
  workLogs,
}: {
  workLogs: EmployeeWorkLogPage["items"];
}) {
  if (workLogs.length === 0) {
    return <EmptyState title="Записів про роботи немає" />;
  }

  return (
    <div className="space-y-3">
      {workLogs.map((workLog) => (
        <article
          key={workLog.id}
          className="vc-surface min-w-0 p-4"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {formatDate(workLog.work_date)}
              </p>
              {workLog.object ? (
                <Link
                  href={`/objects/${workLog.object.id}`}
                  className="mt-1 inline-block break-words text-sm font-medium text-[var(--vc-success-text)] hover:underline"
                >
                  {workLog.object.name}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Об’єкт не знайдено
                </p>
              )}
            </div>
            <span className="w-fit shrink-0 rounded-full bg-[var(--vc-info-bg)] px-3 py-1 text-sm font-medium text-[var(--vc-info-text)]">
              {formatHours(Number(workLog.hours || 0))} год.
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {workLog.description}
          </p>
        </article>
      ))}
    </div>
  );
}

function ObjectCards({
  objects,
  today,
}: {
  objects: ObjectItem[];
  today: string;
}) {
  if (objects.length === 0) {
    return <EmptyState title="Закріплених об’єктів немає" />;
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
      {objects.map((object) => (
        <Link
          key={object.id}
          href={`/objects/${object.id}`}
          className="vc-surface min-w-0 p-4 transition hover:border-border hover:bg-[var(--vc-success-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="break-words font-semibold text-foreground">
              {object.name}
            </h3>
            <span className="w-fit shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              {object.status}
            </span>
          </div>
          <p className="mt-2 break-words text-sm text-muted-foreground">
            {object.address || "Адресу не вказано"}
          </p>
          <span
            className={`mt-3 inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-medium ${getSupervisionClasses(
              object,
              today
            )}`}
          >
            <span className="truncate">
              {getSupervisionLabel(object, today)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function EquipmentCards({
  equipment,
  today,
}: {
  equipment: Equipment[];
  today: string;
}) {
  if (equipment.length === 0) {
    return <EmptyState title="Закріпленої техніки немає" />;
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
      {equipment.map((item) => {
        const evaluation = evaluateEquipmentMaintenance(item, today);

        return (
          <article
            key={item.id}
            className="vc-surface min-w-0 p-4"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-semibold text-foreground">
                  {item.name}
                </h3>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {item.inventory_number ||
                    "Інвентарний номер не вказано"}
                </p>
              </div>
              <span className="w-fit shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {item.status}
              </span>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap gap-2 border-t pt-3">
              <span
                className={`max-w-full rounded-full px-2.5 py-1 text-xs font-medium ${getMaintenanceClasses(
                  item,
                  today
                )}`}
              >
                {getEquipmentMaintenanceOverallLabel(evaluation)}
              </span>
              {item.location && (
                <span className="max-w-full truncate rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {item.location}
                </span>
              )}
            </div>
            <Link
              href="/equipment"
              className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-[var(--vc-success-text)] hover:underline"
            >
              Відкрити техніку →
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function EmployeeOverview({
  employee,
  hourlyRate,
  isAdmin,
  today,
  kpis,
  taskPreview,
  workLogPreview,
  supervisionPreview,
  recentActivity,
}: {
  employee: EmployeeDetails;
  hourlyRate: number | null;
  isAdmin: boolean;
  today: string;
  kpis: EmployeeProfileKpis;
  taskPreview: TaskWithObject[];
  workLogPreview: EmployeeWorkLogPage["items"];
  supervisionPreview: EmployeeSupervisionPreview[];
  recentActivity: ActivityLog[];
}) {
  const kpiItems: Array<{
    label: string;
    value: string | number;
    className: string;
  }> = [
    { label: "Активні", value: kpis.activeTasks, className: "text-[var(--vc-info-text)]" },
    {
      label: "Прострочені",
      value: kpis.overdueTasks,
      className: kpis.overdueTasks > 0 ? "text-[var(--vc-danger-text)]" : "text-foreground",
    },
    { label: "Виконані", value: kpis.completedTasks, className: "text-[var(--vc-success-text)]" },
    { label: "Годин цього місяця", value: formatHours(kpis.monthlyHours), className: "text-[var(--vc-info-text)]" },
    { label: "Годин загалом", value: formatHours(kpis.lifetimeHours), className: "text-[var(--vc-info-text)]" },
    { label: "Об’єкти", value: kpis.objects, className: "text-foreground" },
    { label: "Техніка", value: kpis.equipment, className: "text-[var(--vc-warning-text)]" },
  ];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <section className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        {kpiItems.map((item) => (
          <div
            key={item.label}
            className="vc-surface min-w-0 p-3 sm:p-4"
          >
            <p className="text-xs leading-4 text-muted-foreground">{item.label}</p>
            <p className={`mt-2 break-words text-2xl font-semibold tabular-nums ${item.className}`}>
              {item.value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="vc-surface min-w-0 p-4 sm:p-5">
          <SectionHeader
            title="Найближчі завдання"
            description="До п’яти активних завдань із найближчим терміном."
          />
          <div className="mt-4">
            <TaskCards tasks={taskPreview} compact />
          </div>
        </div>
        <div className="vc-surface min-w-0 p-4 sm:p-5">
          <SectionHeader
            title="Останні роботи"
            description="Три останні записи журналу робіт."
          />
          <div className="mt-4">
            <WorkLogCards workLogs={workLogPreview} />
          </div>
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="vc-surface min-w-0 p-4 sm:p-5">
          <SectionHeader
            title="Відповідальність за огляди"
            description="Об’єкти з налаштованим періодичним наглядом."
          />
          <div className="mt-4 space-y-2">
            {supervisionPreview.length === 0 ? (
              <EmptyState title="Огляди не закріплені" />
            ) : (
              supervisionPreview.map((object) => (
                <Link
                  key={object.id}
                  href={`/objects/${object.id}`}
                  className="flex min-w-0 flex-col gap-2 rounded-lg border p-3 transition hover:border-border hover:bg-[var(--vc-success-bg)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 break-words font-medium text-foreground">
                    {object.name}
                  </span>
                  <span
                    className={`w-fit max-w-full shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getSupervisionClasses(
                      object,
                      today
                    )}`}
                  >
                    {getSupervisionLabel(object, today)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="vc-surface min-w-0 p-4 sm:p-5">
          <SectionHeader
            title="Остання активність"
            description="Останні зміни профілю та дії пов’язаного акаунта."
          />
          <div className="mt-4">
            {recentActivity.length === 0 ? (
              <EmptyState title="Активності поки немає" />
            ) : (
              <ActivityTimelineList
                logs={recentActivity}
                existingObjectIds={[]}
                compact
              />
            )}
          </div>
        </div>
      </section>

      {(employee.notes || isAdmin) && (
        <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          {employee.notes && (
            <div className="vc-surface min-w-0 p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Примітки
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {employee.notes}
              </p>
            </div>
          )}
          {isAdmin && (
            <div className="min-w-0 rounded-lg border border-border bg-[var(--vc-info-bg)] p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--vc-info-text)]">
                Дані адміністратора
              </p>
              <p className="mt-2 text-sm text-[var(--vc-info-text)]">Погодинна ставка</p>
              <p className="mt-1 break-words text-xl font-bold text-[var(--vc-info-text)]">
                {formatRate(hourlyRate ?? 0)}
                <span className="ml-1 text-sm font-medium text-[var(--vc-info-text)]">
                  / год.
                </span>
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function EmployeeTasksTab({
  employeeId,
  page,
}: {
  employeeId: number;
  page: EmployeeTaskPage;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <SectionHeader
        title="Завдання працівника"
        description="Повна історія разових та автоматичних завдань у режимі перегляду."
      />
      <TaskCards tasks={page.items} />
      <EmployeeTabPagination employeeId={employeeId} tab="tasks" {...page} />
    </section>
  );
}

export function EmployeeWorkLogsTab({
  employeeId,
  page,
}: {
  employeeId: number;
  page: EmployeeWorkLogPage;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <SectionHeader
        title="Журнал робіт"
        description="Роботи працівника на об’єктах без фінансових ставок і розрахунків."
      />
      <WorkLogCards workLogs={page.items} />
      <EmployeeTabPagination employeeId={employeeId} tab="work" {...page} />
    </section>
  );
}

export function EmployeeObjectsTab({
  employeeId,
  page,
  today,
}: {
  employeeId: number;
  page: EmployeeObjectPage;
  today: string;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <SectionHeader
        title="Закріплені об’єкти"
        description="Об’єкти, де працівник вказаний відповідальним. Фінансові дані тут не показуються."
      />
      <ObjectCards objects={page.items} today={today} />
      <EmployeeTabPagination employeeId={employeeId} tab="objects" {...page} />
    </section>
  );
}

export function EmployeeEquipmentTab({
  employeeId,
  page,
  workSessionsPage,
  canViewObjectProfiles,
  today,
}: {
  employeeId: number;
  page: EmployeeEquipmentPage;
  workSessionsPage: EquipmentWorkSessionPage;
  canViewObjectProfiles: boolean;
  today: string;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <section className="min-w-0 space-y-4">
        <SectionHeader
          title="Закріплена техніка"
          description="Стан техніки та планового обслуговування."
        />
        <EquipmentCards
          equipment={page.items}
          today={today}
        />
        <EmployeeTabPagination
          employeeId={employeeId}
          tab="equipment"
          preservedPage={
            workSessionsPage.page
          }
          {...page}
        />
      </section>

      <EquipmentWorkSessionList
        items={workSessionsPage.items}
        total={workSessionsPage.total}
        context="employee"
        canViewObjectProfiles={
          canViewObjectProfiles
        }
      />
      <EmployeeTabPagination
        employeeId={employeeId}
        tab="equipment"
        parameter="workPage"
        preservedPage={page.page}
        page={workSessionsPage.page}
        pageSize={
          workSessionsPage.pageSize
        }
        total={workSessionsPage.total}
        hasPreviousPage={
          workSessionsPage.hasPreviousPage
        }
        hasNextPage={
          workSessionsPage.hasNextPage
        }
      />
    </div>
  );
}

export function EmployeeHistoryTab({
  employeeId,
  changesPage,
  actorHistoryPage,
  linkedActors,
}: {
  employeeId: number;
  changesPage: EmployeeActivityPage;
  actorHistoryPage: EmployeeActivityPage;
  linkedActors: EmployeeActor[];
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
      <section className="min-w-0 space-y-4">
        <SectionHeader
          title="Зміни працівника"
          description="Створення, редагування та інші зміни самого профілю."
        />
        {changesPage.items.length === 0 ? (
          <EmptyState title="Змін профілю поки немає" />
        ) : (
          <ActivityTimelineList
            logs={changesPage.items}
            existingObjectIds={[]}
            compact
          />
        )}
        <EmployeeTabPagination
          employeeId={employeeId}
          tab="history"
          parameter="changesPage"
          preservedPage={actorHistoryPage.page}
          {...changesPage}
        />
      </section>

      <section className="min-w-0 space-y-4">
        <SectionHeader
          title="Дії працівника"
          description="Бізнес-дії, виконані пов’язаним користувацьким акаунтом."
        />
        {linkedActors.length === 0 ? (
          <EmptyState
            title="Акаунт не прив’язано"
            description="Для цього працівника немає пов’язаного профілю користувача."
          />
        ) : actorHistoryPage.items.length === 0 ? (
          <EmptyState title="Дій поки немає" />
        ) : (
          <ActivityTimelineList
            logs={actorHistoryPage.items}
            existingObjectIds={[]}
            compact
          />
        )}
        {linkedActors.length > 0 && (
          <EmployeeTabPagination
            employeeId={employeeId}
            tab="history"
            parameter="actionsPage"
            preservedPage={changesPage.page}
            {...actorHistoryPage}
          />
        )}
      </section>
    </div>
  );
}
