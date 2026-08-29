import type { TaskWithObject } from "@/types/taskWithObject";

export type TaskTarget = {
  type: "object" | "equipment";
  id: number;
  name: string;
  href: string;
  label: "Об’єкт" | "Техніка";
};

export function getTaskTarget(
  task: Pick<
    TaskWithObject,
    | "object_id"
    | "equipment_id"
    | "object"
    | "equipment"
  >
): TaskTarget | null {
  if (
    task.object_id !== null &&
    task.object
  ) {
    return {
      type: "object",
      id: task.object.id,
      name: task.object.name,
      href: `/objects/${task.object.id}`,
      label: "Об’єкт",
    };
  }

  if (
    task.equipment_id !== null &&
    task.equipment
  ) {
    return {
      type: "equipment",
      id: task.equipment.id,
      name: task.equipment.name,
      href: "/equipment",
      label: "Техніка",
    };
  }

  return null;
}
