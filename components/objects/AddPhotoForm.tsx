"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Props = {
  objectId: number;
  onUploaded?: () => void;
};

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

function getErrorMessage(
  error: unknown
): string {
  if (
    typeof error ===
    "string"
  ) {
    return error;
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error ===
      "object" &&
    error !== null
  ) {
    const supabaseError =
      error as {
        message?: string;
        error?: string;
        code?: string;
        statusCode?:
          | string
          | number;
        details?: string;
        hint?: string;
      };

    const parts = [
      supabaseError.message,
      supabaseError.error,
      supabaseError.code,

      supabaseError.statusCode
        ? `Статус: ${supabaseError.statusCode}`
        : "",

      supabaseError.details,
      supabaseError.hint,
    ].filter(Boolean);

    if (
      parts.length > 0
    ) {
      return parts.join(
        " — "
      );
    }
  }

  return "Невідома помилка під час завантаження.";
}

export default function AddPhotoForm({
  objectId,
  onUploaded,
}: Props) {
  const router =
    useRouter();

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const supabase =
      createClient();

    const form =
      event.currentTarget;

    const formData =
      new FormData(form);

    const photo =
      formData.get(
        "photo"
      );

    const caption =
      String(
        formData.get(
          "caption"
        ) ?? ""
      ).trim();

    setErrorMessage("");

    if (
      !(
        photo instanceof File
      ) ||
      photo.size === 0
    ) {
      setErrorMessage(
        "Обери фотографію."
      );

      return;
    }

    if (
      !photo.type.startsWith(
        "image/"
      )
    ) {
      setErrorMessage(
        "Можна завантажувати лише зображення."
      );

      return;
    }

    if (
      photo.size >
      MAX_FILE_SIZE
    ) {
      setErrorMessage(
        "Максимальний розмір фотографії — 10 МБ."
      );

      return;
    }

    const originalExtension =
      photo.name
        .split(".")
        .pop()
        ?.toLowerCase() ||
      photo.type.split(
        "/"
      )[1] ||
      "jpg";

    const extension =
      originalExtension.replace(
        /[^a-z0-9]/g,
        ""
      ) || "jpg";

    const uniqueId =
      typeof crypto !==
        "undefined" &&
      typeof crypto.randomUUID ===
        "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    const storagePath =
      `${objectId}/${uniqueId}.${extension}`;

    setIsUploading(true);

    try {
      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            "object-photos"
          )
          .upload(
            storagePath,
            photo,
            {
              cacheControl:
                "3600",

              contentType:
                photo.type,

              upsert:
                false,
            }
          );

      if (uploadError) {
        console.error(
          "Помилка Storage:",
          uploadError
        );

        setErrorMessage(
          `Помилка завантаження файла: ${getErrorMessage(
            uploadError
          )}`
        );

        return;
      }

      const {
        error:
          databaseError,
      } =
        await supabase
          .from(
            "object_photos"
          )
          .insert({
            object_id:
              objectId,

            storage_path:
              storagePath,

            caption:
              caption ||
              null,
          });

      if (
        databaseError
      ) {
        console.error(
          "Помилка таблиці object_photos:",
          databaseError
        );

        await supabase.storage
          .from(
            "object-photos"
          )
          .remove([
            storagePath,
          ]);

        setErrorMessage(
          `Фото завантажилося, але запис не зберігся: ${getErrorMessage(
            databaseError
          )}`
        );

        return;
      }

      form.reset();

      router.refresh();

      onUploaded?.();
    } catch (error) {
      console.error(
        "Непередбачена помилка:",
        error
      );

      setErrorMessage(
        `Не вдалося завантажити фотографію: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setIsUploading(
        false
      );
    }
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-4"
    >
      <div>
        <label className="mb-2 block text-sm font-medium">
          Фотографія
        </label>

        <input
          type="file"
          name="photo"
          accept="image/*"
          className="w-full rounded-lg border bg-white p-3"
          required
        />

        <p className="mt-2 text-xs text-gray-500">
          Максимальний
          розмір — 10 МБ.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Підпис
        </label>

        <input
          type="text"
          name="caption"
          placeholder="Наприклад: ділянка після висаджування"
          className="w-full rounded-lg border bg-white p-3"
        />
      </div>

      {errorMessage && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {
            errorMessage
          }
        </p>
      )}

      <button
        type="submit"
        disabled={
          isUploading
        }
        className="rounded-lg bg-green-600 px-5 py-3 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUploading
          ? "Завантаження..."
          : "Завантажити фото"}
      </button>
    </form>
  );
}