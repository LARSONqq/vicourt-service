import type { ObjectTask } from "@/types/objectTask";

export interface TaskChecklistSummaryItem {
  id: number;
  is_completed: boolean;
}

export interface TaskWithObject
  extends ObjectTask {
  object: {
    id: number;
    name: string;
  } | null;

  equipment: {
    id: number;
    name: string;
    inventory_number: string | null;
  } | null;

  checklist_items?: TaskChecklistSummaryItem[];
}
