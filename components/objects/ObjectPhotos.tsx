"use client";

import { useState } from "react";

import { deleteObjectPhoto } from "@/app/actions/photoActions";

import type { ObjectPhoto } from "@/types/objectPhoto";
import type { ClientPhotoPublicationEditorState } from "@/types/clientPhoto";
import ClientPhotoPublicationEditor from "./ClientPhotoPublicationEditor";

import AddPhotoForm from "./AddPhotoForm";

type Props = {
  photos: ObjectPhoto[];
  objectId: number;
  canManage?: boolean;
  totalCount?: number;
  publications?: ClientPhotoPublicationEditorState[];
};

export default function ObjectPhotos({
  photos,
  objectId,
  canManage = false,
  totalCount,
  publications,
}: Props) {
  const publicationStateLoaded = publications !== undefined;
const publicationsById = new Map(
  (publications ?? []).map((item) => [item.photo_id, item]),
);
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  return (
    <section className="vc-object-panel vc-surface min-w-0 p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">
            Фото
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Фотографії з об’єкта
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Завантажено: {photos.length}
            {totalCount !== undefined &&
            totalCount !==
              photos.length
              ? ` із ${totalCount}`
              : ""}
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
          className={`min-h-11 w-full rounded-md px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-fit ${
            showForm
              ? "border border-border bg-card text-foreground hover:bg-muted"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
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
        <div className="mb-5 min-w-0 rounded-lg border border-border bg-muted/35 p-3 sm:mb-6 sm:p-4">
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
        <div className="rounded-lg border border-dashed border-border bg-muted/35 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-card text-xl">
            📷
          </div>

          <p className="mt-3 font-medium text-foreground">
            Фото ще не завантажені
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
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
                className="min-w-0 overflow-hidden rounded-lg border border-border bg-card"
              >
                {/* IMAGE */}
                <a
                  href={
                    photo.public_url
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="group block overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
                    className="h-64 w-full object-cover transition duration-200 group-hover:scale-[1.02] motion-reduce:transition-none sm:h-56"
                  />
                </a>

                {/* INFO */}
                <div className="p-3 sm:p-4">
                  {canManage && <p className="mb-1 text-xs text-muted-foreground">Внутрішній підпис</p>}
                  {photo.caption ? (
                    <p className="break-words text-sm leading-5 text-foreground">
                      {
                        photo.caption
                      }
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Без підпису
                    </p>
                  )}

                  {canManage && (
  publicationStateLoaded ? (
    <ClientPhotoPublicationEditor
      key={JSON.stringify([
        objectId,
        photo.id,
        publicationsById.get(photo.id) ?? null,
      ])}
      objectId={objectId}
      initialPublication={publicationsById.get(photo.id) ?? null}
    />
  ) : (
    <p className="vc-panel-warning mt-3 rounded-md px-3 py-2 text-sm">
      Не вдалося завантажити стан публікації для клієнта.
    </p>
  )
)}

                  {canManage && (
                  <div className="mt-3 border-t border-border pt-3">
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
                        className="min-h-10 w-full rounded-md border border-destructive/25 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
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
