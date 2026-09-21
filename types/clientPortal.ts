// Deliberately separate from the internal ObjectItem and UserProfile contracts.
export type ClientObjectSummary = {
  id: number;
  name: string;
  address: string | null;
  status: string;
};

export type ClientObjectProfile = ClientObjectSummary;

export type ClientProfile = {
  user_id: string;
  display_name: string;
  is_active: boolean;
};

export type ClientObjectGrant = {
  client_user_id: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
};

export type ClientProgressStageStatus = "planned" | "in_progress" | "completed";

export type ClientProgressStage = {
  id: number;
  title: string;
  status: ClientProgressStageStatus;
  sort_order: number;
};

export type ClientObjectProgress = {
  object_id: number;
  overall_percent: number;
  completed_summary: string | null;
  next_summary: string | null;
  updated_at: string;
  stages: ClientProgressStage[];
};

// Never pass this management contract directly into a client portal component.
export type ManagementClientObjectProgress = ClientObjectProgress & { version: number };

export type SaveClientObjectProgressInput = {
  object_id: number;
  overall_percent: number;
  completed_summary: string | null;
  next_summary: string | null;
  stages: (Omit<ClientProgressStage, "id"> & { id?: number | null })[];
  // 0 means first publication; otherwise the version from the management RPC.
  expected_version: number;
};
