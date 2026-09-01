"use server";

import { revalidatePath } from "next/cache";

import { canManageObjects } from "@/lib/auth/permissions";
import {
  formatDateValue,
  isValidDateValue,
} from "@/lib/kyivDate";
import { createClient } from "@/lib/supabase/server";
import { recordActivity } from "@/services/activityLogService";
import { getCurrentUserProfile } from "@/services/profileService";

const MAX_SCHEDULE_AMOUNT = 999_999_999_999.99;
const MAX_TITLE_LENGTH = 150;
const MAX_NOTE_LENGTH = 2_000;

type ScheduleSnapshot = {
  id: number;
  object_id: number;
  title: string;
  due_date: string;
  amount: number;
  note: string | null;
};

function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function getPositiveId(value: unknown, message: string) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(message);
  return id;
}

function getScheduleAmount(formData: FormData) {
  const rawValue = getText(formData, "amount").replace(",", ".");

  if (!/^\d+(?:\.\d{1,2})?$/.test(rawValue)) {
    throw new Error("Планова сума повинна бути числом із не більш ніж двома знаками після коми.");
  }

  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_SCHEDULE_AMOUNT) {
    throw new Error("Планова сума повинна бути більшою за нуль і не перевищувати допустимий ліміт.");
  }
  return amount;
}

function validateText(value: string, maxLength: number, label: string, required = false) {
  if (required && !value) throw new Error(`${label} є обов’язковою.`);
  if (value.length > maxLength) {
    throw new Error(`${label} не може бути довшою за ${maxLength} символів.`);
  }
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(value)} грн`;
}

async function requireScheduleAccess() {
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error("Потрібно увійти в систему.");
  if (!canManageObjects(profile.role)) {
    throw new Error("У тебе немає прав для керування графіком оплат.");
  }
}

async function getObjectSnapshot(objectId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("objects")
    .select("id, name")
    .eq("id", objectId)
    .maybeSingle();

  if (error) throw new Error(`Не вдалося перевірити об’єкт: ${error.message}`);
  if (!data) throw new Error("Об’єкт не знайдено.");
  return data;
}

async function getScheduleSnapshot(scheduleId: number, objectId: number): Promise<ScheduleSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("object_payment_schedule")
    .select("id, object_id, title, due_date, amount, note")
    .eq("id", scheduleId)
    .eq("object_id", objectId)
    .maybeSingle();

  if (error) throw new Error(`Не вдалося перевірити етап оплати: ${error.message}`);
  if (!data) throw new Error("Етап оплати не знайдено для цього об’єкта.");

  return {
    id: Number(data.id),
    object_id: Number(data.object_id),
    title: data.title,
    due_date: data.due_date,
    amount: Number(data.amount),
    note: data.note,
  };
}

function parseScheduleInput(formData: FormData) {
  const objectId = getPositiveId(formData.get("object_id"), "Не вдалося визначити об’єкт.");
  const title = getText(formData, "title");
  const dueDate = getText(formData, "due_date");
  const amount = getScheduleAmount(formData);
  const note = getText(formData, "note");

  validateText(title, MAX_TITLE_LENGTH, "Назва етапу", true);
  validateText(note, MAX_NOTE_LENGTH, "Примітка");
  if (!isValidDateValue(dueDate)) throw new Error("Вкажи коректну дату платежу.");

  return { objectId, title, dueDate, amount, note: note || null };
}

function refreshSchedulePages(objectId: number) {
  revalidatePath("/");
  revalidatePath(`/objects/${objectId}`);
  revalidatePath("/reports");
  revalidatePath("/notifications");
}

export async function createObjectPaymentScheduleItem(formData: FormData) {
  await requireScheduleAccess();
  const input = parseScheduleInput(formData);
  const object = await getObjectSnapshot(input.objectId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("object_payment_schedule")
    .insert({
      object_id: input.objectId,
      title: input.title,
      due_date: input.dueDate,
      amount: input.amount,
      note: input.note,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Не вдалося додати етап оплати: ${error.message}`);

  await recordActivity({
    action: "object.payment_schedule.created",
    entityType: "object_payment_schedule",
    entityId: data.id,
    entityName: input.title,
    objectId: input.objectId,
    objectName: object.name,
    description: `Додано етап оплати «${input.title}» — ${formatMoney(input.amount)} до ${formatDateValue(input.dueDate)}.`,
    metadata: {
      object_id: input.objectId,
      schedule_item_id: Number(data.id),
      title: input.title,
      amount: input.amount,
      due_date: input.dueDate,
    },
  });
  refreshSchedulePages(input.objectId);
}

export async function updateObjectPaymentScheduleItem(formData: FormData) {
  await requireScheduleAccess();
  const input = parseScheduleInput(formData);
  const scheduleId = getPositiveId(formData.get("schedule_id"), "Не вдалося визначити етап оплати.");
  const [object, previous] = await Promise.all([
    getObjectSnapshot(input.objectId),
    getScheduleSnapshot(scheduleId, input.objectId),
  ]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("object_payment_schedule")
    .update({
      title: input.title,
      due_date: input.dueDate,
      amount: input.amount,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId)
    .eq("object_id", input.objectId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Не вдалося оновити етап оплати: ${error.message}`);
  if (!data) throw new Error("Етап оплати не знайдено для цього об’єкта.");

  await recordActivity({
    action: "object.payment_schedule.updated",
    entityType: "object_payment_schedule",
    entityId: scheduleId,
    entityName: input.title,
    objectId: input.objectId,
    objectName: object.name,
    description: `Оновлено етап оплати «${input.title}» по об’єкту «${object.name}».`,
    metadata: {
      object_id: input.objectId,
      schedule_item_id: scheduleId,
      old_title: previous.title,
      new_title: input.title,
      old_amount: previous.amount,
      new_amount: input.amount,
      old_due_date: previous.due_date,
      new_due_date: input.dueDate,
      old_note: previous.note,
      new_note: input.note,
    },
  });
  refreshSchedulePages(input.objectId);
}

export async function deleteObjectPaymentScheduleItem(scheduleId: number, objectId: number) {
  await requireScheduleAccess();
  const normalizedScheduleId = getPositiveId(scheduleId, "Не вдалося визначити етап оплати.");
  const normalizedObjectId = getPositiveId(objectId, "Не вдалося визначити об’єкт.");
  const [object, schedule] = await Promise.all([
    getObjectSnapshot(normalizedObjectId),
    getScheduleSnapshot(normalizedScheduleId, normalizedObjectId),
  ]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("object_payment_schedule")
    .delete()
    .eq("id", normalizedScheduleId)
    .eq("object_id", normalizedObjectId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Не вдалося видалити етап оплати: ${error.message}`);
  if (!data) throw new Error("Етап оплати не знайдено для цього об’єкта.");

  await recordActivity({
    action: "object.payment_schedule.deleted",
    entityType: "object_payment_schedule",
    entityId: normalizedScheduleId,
    entityName: schedule.title,
    objectId: normalizedObjectId,
    objectName: object.name,
    description: `Видалено етап оплати «${schedule.title}» по об’єкту «${object.name}».`,
    metadata: {
      object_id: normalizedObjectId,
      schedule_item_id: normalizedScheduleId,
      title: schedule.title,
      amount: schedule.amount,
      due_date: schedule.due_date,
      note: schedule.note,
    },
  });
  refreshSchedulePages(normalizedObjectId);
}
