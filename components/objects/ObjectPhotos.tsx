"use client";

import { useState } from "react";

import { deleteObjectPhoto } from "@/app/actions/photoActions";

import type { ObjectPhoto } from "@/types/objectPhoto";

import AddPhotoForm from "./AddPhotoForm";

type Props = {
  photos: ObjectPhoto[];
  objectId: number;
  canManage?: boolean;
};

export default function ObjectPhotos({
  photos,
  objectId,
  canManage = false,
}: Props) {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            Фото
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Фотографії з об’єкта
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Завантажено: {photos.length}
          </p>
        </div>

        {canManage && (
        <button
          type="button"
          onClick={() =>
            setShowForm(
              (previous) =>
                !previous
            )
          }
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition sm:w-fit ${
            showForm
              ? "border bg-white text-gray-700 hover:bg-gray-50"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {showForm
            ? "Закрити форму"
            : "+ Додати фото"}
        </button>
        )}
      </div>

      {/* ADD PHOTO */}
      {showForm && canManage && (
        <div className="mb-5 min-w-0 rounded-xl border bg-gray-50 p-3 sm:mb-6 sm:p-4">
          <AddPhotoForm
            objectId={objectId}
            onUploaded={() =>
              setShowForm(false)
            }
          />
        </div>
      )}

      {/* EMPTY */}
      {photos.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl">
            📷
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Фото ще не завантажені
          </p>

          <p className="mt-1 text-sm text-gray-500">
            {canManage
              ? "Додай фотографії виконаних робіт або стану об’єкта."
              : "Для цього об’єкта фотографій немає."}
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {photos.map(
            (photo) => (
              <article
                key={photo.id}
                className="min-w-0 overflow-hidden rounded-xl border bg-white"
              >
                {/* IMAGE */}
                <a
                  href={
                    photo.public_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden bg-gray-100"
                >
                  <img
                    src={
                      photo.public_url
                    }
                    alt={
                      photo.caption ||
                      "Фото об’єкта"
                    }
                    loading="lazy"
                    decoding="async"
                    className="h-64 w-full object-cover transition duration-200 group-hover:scale-105 sm:h-56"
                  />
                </a>

                {/* INFO */}
                <div className="p-3 sm:p-4">
                  {photo.caption ? (
                    <p className="break-words text-sm leading-5 text-gray-700">
                      {
                        photo.caption
                      }
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Без підпису
                    </p>
                  )}

                  {canManage && (
                  <div className="mt-3 border-t pt-3">
                    <form
                      action={deleteObjectPhoto.bind(
                        null,
                        photo.id,
                        objectId
                      )}
                      onSubmit={(
                        event
                      ) => {
                        const confirmed =
                          window.confirm(
                            "Видалити цю фотографію?"
                          );

                        if (
                          !confirmed
                        ) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <button
                        type="submit"
                        className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 sm:w-auto"
                      >
                        Видалити
                      </button>
                    </form>
                  </div>
                  )}
                </div>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}
