import TaskWorkspaceShell from "@/components/tasks/TaskWorkspaceShell";
import { canManageEquipment, canManageObjects, canManageTasks } from "@/lib/auth/permissions";
import { requireSectionAccess } from "@/lib/auth/requireAccess";
import { getKyivDateValue } from "@/lib/kyivDate";
import { getEmployees } from "@/services/employeeService";
import { getEquipment } from "@/services/equipmentService";
import { getObjects } from "@/services/objectService";
import { getTaskWorkspaceCounts } from "@/services/taskWorkspaceService";

export default async function TaskWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSectionAccess("tasks");
  const today = getKyivDateValue();
  // Operational selectors contain no rates or costs and support the existing worker task flow.
  const [objects, employees, equipment, counts] = await Promise.all([
    getObjects(),
    getEmployees(),
    getEquipment(),
    getTaskWorkspaceCounts(profile.employee_id, today),
  ]);

  return <TaskWorkspaceShell
    objects={objects}
    employees={employees}
    equipment={equipment}
    counts={counts}
    employeeId={profile.employee_id}
    today={today}
    canManageObjects={canManageObjects(profile.role)}
    canManageEquipment={canManageEquipment(profile.role)}
    canManageRecurrence={canManageTasks(profile.role)}
  >
    {children}
  </TaskWorkspaceShell>;
}
