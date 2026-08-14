export type AppCurrency = "UAH" | "USD" | "EUR";

export interface AppSettings {
  id: number;
  company_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currency: AppCurrency;
  updated_at: string;
}
