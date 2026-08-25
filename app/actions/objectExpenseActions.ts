"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  canManageObjects,
} from "@/lib/auth/permissions";

import {
  getCurrentUserProfile,
} from "@/services/profileService";

import {
  recordActivity,
} from "@/services/activityLogService";

import {
  objectExpenseCategories,
} from "@/constants/objectExpenses";

import type {
  ObjectExpenseCategory,
} from "@/constants/objectExpenses";

async function requireExpenseManagementAccess() {
  const profile =
    await getCurrentUserProfile();

  if (!profile) {
    throw new Error(
      "Потрібно увійти в систему."
    );
  }

  if (
    !canManageObjects(
      profile.role
    )
  ) {
    throw new Error(
      "У тебе немає прав для керування витратами об’єкта."
    );
  }

  return profile;
}

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ??
      ""
  ).trim();
}

function getPositiveAmount(
  formData: FormData,
  field: string
) {
  const rawValue =
    getText(
      formData,
      field
    ).replace(
      ",",
      "."
    );

  const value =
    Number(rawValue);

  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    throw new Error(
      "Сума витрати повинна бути більшою за нуль."
    );
  }

  return value;
}

function validateId(
  value: number,
  message: string
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value <= 0
  ) {
    throw new Error(
      message
    );
  }
}

function validateCategory(
  value: string
): asserts value is ObjectExpenseCategory {
  if (
    !objectExpenseCategories.includes(
      value as ObjectExpenseCategory
    )
  ) {
    throw new Error(
      "Обери правильну категорію витрати."
    );
  }
}

function refreshExpensePages(
  objectId: number
) {
  revalidatePath(
    `/objects/${objectId}`
  );

  revalidatePath(
    "/objects"
  );

  revalidatePath(
    "/reports"
  );

  revalidatePath("/");
}

async function getExpenseSnapshot(
  expenseId: number,
  objectId: number
) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "object_expenses"
    )
    .select(`
      id,
      expense_date,
      category,
      description,
      amount
    `)
    .eq(
      "id",
      expenseId
    )
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle();

  if (error) {
    console.error(
      "[ActivityLog] Не вдалося отримати snapshot витрати.",
      {
        expenseId,
        objectId,
        message:
          error.message,
      }
    );

    return null;
  }

  return data;
}

export async function createObjectExpense(
  formData: FormData
) {
  await requireExpenseManagementAccess();

  const supabase =
    await createClient();

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const expenseDate =
    getText(
      formData,
      "expense_date"
    );

  const category =
    getText(
      formData,
      "category"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const amount =
    getPositiveAmount(
      formData,
      "amount"
    );

  const note =
    getText(
      formData,
      "note"
    );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  if (!expenseDate) {
    throw new Error(
      "Вкажи дату витрати."
    );
  }

  validateCategory(
    category
  );

  if (!description) {
    throw new Error(
      "Вкажи опис витрати."
    );
  }

  const {
    data: createdExpense,
    error,
  } = await supabase
    .from(
      "object_expenses"
    )
    .insert({
      object_id:
        objectId,

      expense_date:
        expenseDate,

      category,

      description,

      amount,

      note:
        note || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Не вдалося додати витрату: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "object_expense.created",
    entityType:
      "object_expense",
    entityId:
      createdExpense.id,
    entityName:
      description,
    objectId,
    description:
      `Додав витрату «${description}» на суму ${amount} грн.`,
    metadata: {
      expense_date:
        expenseDate,
      category,
      amount,
    },
  });

  refreshExpensePages(
    objectId
  );
}

export async function updateObjectExpense(
  formData: FormData
) {
  await requireExpenseManagementAccess();

  const supabase =
    await createClient();

  const expenseId =
    Number(
      formData.get(
        "expense_id"
      )
    );

  const objectId =
    Number(
      formData.get(
        "object_id"
      )
    );

  const expenseDate =
    getText(
      formData,
      "expense_date"
    );

  const category =
    getText(
      formData,
      "category"
    );

  const description =
    getText(
      formData,
      "description"
    );

  const amount =
    getPositiveAmount(
      formData,
      "amount"
    );

  const note =
    getText(
      formData,
      "note"
    );

  validateId(
    expenseId,
    "Не вдалося визначити витрату."
  );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  if (!expenseDate) {
    throw new Error(
      "Вкажи дату витрати."
    );
  }

  validateCategory(
    category
  );

  if (!description) {
    throw new Error(
      "Вкажи опис витрати."
    );
  }

  const {
    error,
  } = await supabase
    .from(
      "object_expenses"
    )
    .update({
      expense_date:
        expenseDate,

      category,

      description,

      amount,

      note:
        note || null,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      expenseId
    )
    .eq(
      "object_id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося оновити витрату: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "object_expense.updated",
    entityType:
      "object_expense",
    entityId:
      expenseId,
    entityName:
      description,
    objectId,
    description:
      `Змінив витрату «${description}» на суму ${amount} грн.`,
    metadata: {
      expense_date:
        expenseDate,
      category,
      amount,
    },
  });

  refreshExpensePages(
    objectId
  );
}

export async function deleteObjectExpense(
  expenseId: number,
  objectId: number
) {
  await requireExpenseManagementAccess();

  const supabase =
    await createClient();

  validateId(
    expenseId,
    "Не вдалося визначити витрату."
  );

  validateId(
    objectId,
    "Не вдалося визначити об’єкт."
  );

  const expenseSnapshot =
    await getExpenseSnapshot(
      expenseId,
      objectId
    );

  const {
    error,
  } = await supabase
    .from(
      "object_expenses"
    )
    .delete()
    .eq(
      "id",
      expenseId
    )
    .eq(
      "object_id",
      objectId
    );

  if (error) {
    throw new Error(
      `Не вдалося видалити витрату: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "object_expense.deleted",
    entityType:
      "object_expense",
    entityId:
      expenseId,
    entityName:
      expenseSnapshot
        ?.description ||
      `Витрата #${expenseId}`,
    objectId,
    description:
      expenseSnapshot
        ? `Видалив витрату «${expenseSnapshot.description}» на суму ${Number(expenseSnapshot.amount)} грн.`
        : `Видалив витрату #${expenseId}.`,
    metadata: {
      expense_date:
        expenseSnapshot
          ?.expense_date ||
        null,
      category:
        expenseSnapshot
          ?.category ||
        null,
      amount:
        expenseSnapshot
          ? Number(
              expenseSnapshot.amount
            )
          : null,
    },
  });

  refreshExpensePages(
    objectId
  );
}
