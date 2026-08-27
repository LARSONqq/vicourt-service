"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  canManageObjects,
} from "@/lib/auth/permissions";
import {
  isValidDateValue,
} from "@/lib/kyivDate";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  recordActivity,
} from "@/services/activityLogService";
import {
  getCurrentUserProfile,
} from "@/services/profileService";

const MAX_PAYMENT_AMOUNT =
  999_999_999_999.99;
const MAX_PAYMENT_METHOD_LENGTH =
  100;
const MAX_PAYMENT_NOTE_LENGTH =
  2_000;

type PaymentSnapshot = {
  id: number;
  object_id: number;
  payment_date: string;
  amount: number;
  payment_method: string | null;
};

function getText(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ""
  ).trim();
}

function getPositiveId(
  value: unknown,
  message: string
) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(message);
  }

  return id;
}

function getPaymentAmount(
  formData: FormData
) {
  const rawValue = getText(
    formData,
    "amount"
  ).replace(",", ".");

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      rawValue
    )
  ) {
    throw new Error(
      "Сума платежу повинна бути числом із не більш ніж двома знаками після коми."
    );
  }

  const amount =
    Number(rawValue);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount >
      MAX_PAYMENT_AMOUNT
  ) {
    throw new Error(
      "Сума платежу повинна бути більшою за нуль і не перевищувати допустимий ліміт."
    );
  }

  return amount;
}

function validatePaymentDate(
  value: string
) {
  if (!isValidDateValue(value)) {
    throw new Error(
      "Вкажи коректну дату платежу."
    );
  }
}

function validateOptionalText(
  value: string,
  maxLength: number,
  label: string
) {
  if (
    value.length > maxLength
  ) {
    throw new Error(
      `${label} не може бути довшим за ${maxLength} символів.`
    );
  }
}

function formatMoney(
  value: number
) {
  return `${new Intl.NumberFormat(
    "uk-UA",
    {
      maximumFractionDigits: 2,
    }
  ).format(value)} грн`;
}

async function requirePaymentManagementAccess() {
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
      "У тебе немає прав для керування платежами клієнтів."
    );
  }

  return profile;
}

async function getObjectSnapshot(
  objectId: number
) {
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("objects")
    .select("id, name")
    .eq("id", objectId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося перевірити об’єкт: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Об’єкт не знайдено."
    );
  }

  return data;
}

async function getPaymentSnapshot(
  paymentId: number,
  objectId: number
): Promise<PaymentSnapshot> {
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("object_payments")
    .select(`
      id,
      object_id,
      payment_date,
      amount,
      payment_method
    `)
    .eq("id", paymentId)
    .eq(
      "object_id",
      objectId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося перевірити платіж: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Платіж не знайдено для цього об’єкта."
    );
  }

  return {
    id: Number(data.id),
    object_id: Number(
      data.object_id
    ),
    payment_date:
      data.payment_date,
    amount: Number(
      data.amount
    ),
    payment_method:
      data.payment_method,
  };
}

function refreshPaymentPages(
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
}

export async function createObjectPayment(
  formData: FormData
) {
  await requirePaymentManagementAccess();

  const objectId =
    getPositiveId(
      formData.get(
        "object_id"
      ),
      "Не вдалося визначити об’єкт."
    );
  const paymentDate =
    getText(
      formData,
      "payment_date"
    );
  const amount =
    getPaymentAmount(
      formData
    );
  const paymentMethod =
    getText(
      formData,
      "payment_method"
    );
  const note = getText(
    formData,
    "note"
  );

  validatePaymentDate(
    paymentDate
  );
  validateOptionalText(
    paymentMethod,
    MAX_PAYMENT_METHOD_LENGTH,
    "Спосіб оплати"
  );
  validateOptionalText(
    note,
    MAX_PAYMENT_NOTE_LENGTH,
    "Примітка"
  );

  const object =
    await getObjectSnapshot(
      objectId
    );
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("object_payments")
    .insert({
      object_id: objectId,
      payment_date:
        paymentDate,
      amount,
      payment_method:
        paymentMethod || null,
      note: note || null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Не вдалося додати платіж: ${error.message}`
    );
  }

  await recordActivity({
    action:
      "object.payment.created",
    entityType:
      "object_payment",
    entityId: data.id,
    entityName:
      `Платіж ${formatMoney(
        amount
      )}`,
    objectId,
    objectName: object.name,
    description:
      `Додав платіж ${formatMoney(
        amount
      )} по об’єкту «${object.name}».`,
    metadata: {
      object_id: objectId,
      payment_id:
        Number(data.id),
      amount,
      payment_date:
        paymentDate,
      payment_method:
        paymentMethod || null,
    },
  });

  refreshPaymentPages(
    objectId
  );
}

export async function updateObjectPayment(
  formData: FormData
) {
  await requirePaymentManagementAccess();

  const paymentId =
    getPositiveId(
      formData.get(
        "payment_id"
      ),
      "Не вдалося визначити платіж."
    );
  const objectId =
    getPositiveId(
      formData.get(
        "object_id"
      ),
      "Не вдалося визначити об’єкт."
    );
  const paymentDate =
    getText(
      formData,
      "payment_date"
    );
  const amount =
    getPaymentAmount(
      formData
    );
  const paymentMethod =
    getText(
      formData,
      "payment_method"
    );
  const note = getText(
    formData,
    "note"
  );

  validatePaymentDate(
    paymentDate
  );
  validateOptionalText(
    paymentMethod,
    MAX_PAYMENT_METHOD_LENGTH,
    "Спосіб оплати"
  );
  validateOptionalText(
    note,
    MAX_PAYMENT_NOTE_LENGTH,
    "Примітка"
  );

  const [object, previous] =
    await Promise.all([
      getObjectSnapshot(
        objectId
      ),
      getPaymentSnapshot(
        paymentId,
        objectId
      ),
    ]);
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("object_payments")
    .update({
      payment_date:
        paymentDate,
      amount,
      payment_method:
        paymentMethod || null,
      note: note || null,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq(
      "object_id",
      objectId
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося оновити платіж: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Платіж не знайдено для цього об’єкта."
    );
  }

  await recordActivity({
    action:
      "object.payment.updated",
    entityType:
      "object_payment",
    entityId: paymentId,
    entityName:
      `Платіж ${formatMoney(
        amount
      )}`,
    objectId,
    objectName: object.name,
    description:
      `Змінив платіж по об’єкту «${object.name}»: ${formatMoney(
        previous.amount
      )} → ${formatMoney(
        amount
      )}.`,
    metadata: {
      old_amount:
        previous.amount,
      new_amount: amount,
      old_payment_date:
        previous.payment_date,
      new_payment_date:
        paymentDate,
      old_payment_method:
        previous.payment_method,
      new_payment_method:
        paymentMethod || null,
    },
  });

  refreshPaymentPages(
    objectId
  );
}

export async function deleteObjectPayment(
  paymentId: number,
  objectId: number
) {
  await requirePaymentManagementAccess();

  const normalizedPaymentId =
    getPositiveId(
      paymentId,
      "Не вдалося визначити платіж."
    );
  const normalizedObjectId =
    getPositiveId(
      objectId,
      "Не вдалося визначити об’єкт."
    );
  const [object, payment] =
    await Promise.all([
      getObjectSnapshot(
        normalizedObjectId
      ),
      getPaymentSnapshot(
        normalizedPaymentId,
        normalizedObjectId
      ),
    ]);
  const supabase =
    await createClient();
  const {
    data,
    error,
  } = await supabase
    .from("object_payments")
    .delete()
    .eq(
      "id",
      normalizedPaymentId
    )
    .eq(
      "object_id",
      normalizedObjectId
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Не вдалося видалити платіж: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Платіж не знайдено для цього об’єкта."
    );
  }

  await recordActivity({
    action:
      "object.payment.deleted",
    entityType:
      "object_payment",
    entityId:
      normalizedPaymentId,
    entityName:
      `Платіж ${formatMoney(
        payment.amount
      )}`,
    objectId:
      normalizedObjectId,
    objectName: object.name,
    description:
      `Видалив платіж ${formatMoney(
        payment.amount
      )} по об’єкту «${object.name}».`,
    metadata: {
      amount:
        payment.amount,
      payment_date:
        payment.payment_date,
      payment_method:
        payment.payment_method,
    },
  });

  refreshPaymentPages(
    normalizedObjectId
  );
}
