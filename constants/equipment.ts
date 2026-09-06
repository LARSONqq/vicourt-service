export const equipmentCategories = [
  "Газонокосарки",
  "Тримери та мотокоси",
  "Кущорізи",
  "Бензопили",
  "Повітродуви",
  "Культиватор",
  "Щепоріз",
  "Обприскувачі",
  "Електроінструменти",
  "Ручний інструмент",
  "Причеп",
  "Інше",
] as const;

export const equipmentStatuses = [
  "Справна",
  "В роботі",
  "Потребує ремонту",
  "На ремонті",
] as const;

// Keep authenticated equipment reads explicit. These fields are operational
// and are intentionally available to every role that can view Equipment.
export const equipmentOperationalSelect = `
  id,
  name,
  category,
  inventory_number,
  status,
  responsible,
  responsible_employee_id,
  location,
  purchase_date,
  next_service_date,
  notes,
  created_at,
  maintenance_interval_days,
  last_maintenance_date,
  usage_type,
  current_usage,
  maintenance_interval_usage,
  last_maintenance_usage,
  next_maintenance_usage
`;
