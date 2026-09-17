export type WarehouseOperation = "receipt" | "issue" | "return" | "adjustment";

export type WarehouseOperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Loaded only by an authorized management user after opening an operation.
export type WarehouseOperationOptions = {
  currentQuantity: number;
  objects: { id: number; name: string }[];
  allocations: {
    id: number;
    object_id: number;
    quantity: number;
    object: { id: number; name: string } | null;
  }[];
  purchases: {
    id: number;
    quantity: number;
    purchase_price: number;
    supplier: string | null;
    note: string | null;
    created_at: string;
  }[];
  page: number;
  hasMore: boolean;
};
