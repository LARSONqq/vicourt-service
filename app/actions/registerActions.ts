"use server";

import { createClient } from "@/lib/supabase/server";

type RegisterUserInput = {
  fullName: string;
  email: string;
  password: string;
  companyCode: string;
};

type RegisterUserResult = {
  success: boolean;
  message: string;
  requiresEmailConfirmation?: boolean;
};

export async function registerUser(
  input: RegisterUserInput
): Promise<RegisterUserResult> {
  const fullName = String(
    input.fullName ?? ""
  ).trim();

  const email = String(
    input.email ?? ""
  )
    .trim()
    .toLowerCase();

  const password = String(
    input.password ?? ""
  );

  const companyCode = String(
    input.companyCode ?? ""
  ).trim();

  const expectedCode =
    process.env.REGISTRATION_CODE;

  if (!expectedCode) {
    return {
      success: false,
      message:
        "Реєстрація тимчасово недоступна.",
    };
  }

  if (companyCode !== expectedCode) {
    return {
      success: false,
      message:
        "Неправильний код компанії.",
    };
  }

  if (fullName.length < 2) {
    return {
      success: false,
      message:
        "Введи ім’я та прізвище.",
    };
  }

  if (fullName.length > 120) {
    return {
      success: false,
      message:
        "Ім’я занадто довге.",
    };
  }

  if (
    !email ||
    !email.includes("@")
  ) {
    return {
      success: false,
      message:
        "Введи правильний email.",
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message:
        "Пароль повинен містити щонайменше 8 символів.",
    };
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase.auth.signUp({
    email,
    password,

    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    const errorMessage =
      error.message.toLowerCase();

    if (
      errorMessage.includes(
        "user already registered"
      ) ||
      errorMessage.includes(
        "already registered"
      ) ||
      errorMessage.includes(
        "already exists"
      )
    ) {
      return {
        success: false,
        message:
          "Користувач із таким email уже зареєстрований. Спробуй увійти у свій акаунт.",
      };
    }

    if (
      errorMessage.includes(
        "password"
      )
    ) {
      return {
        success: false,
        message:
          "Не вдалося використати цей пароль. Спробуй інший пароль.",
      };
    }

    if (
      errorMessage.includes(
        "email"
      )
    ) {
      return {
        success: false,
        message:
          "Не вдалося використати цей email. Перевір адресу та спробуй ще раз.",
      };
    }

    return {
      success: false,
      message:
        "Не вдалося створити акаунт. Спробуй ще раз.",
    };
  }

  if (!data.user) {
    return {
      success: false,
      message:
        "Не вдалося створити користувача.",
    };
  }

  const requiresEmailConfirmation =
    !data.session;

  if (data.session) {
    await supabase.auth.signOut();
  }

  return {
    success: true,
    requiresEmailConfirmation,

    message:
      requiresEmailConfirmation
        ? "Акаунт створено. Перевір електронну пошту та підтвердь реєстрацію."
        : "Акаунт успішно створено. Тепер можеш увійти.",
  };
}