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
