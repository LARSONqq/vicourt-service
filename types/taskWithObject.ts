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

  checklist_items?: TaskChecklistSummaryItem[];
}