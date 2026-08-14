"use client";

import { useState } from "react";
import { deleteObjectPhoto } from "@/app/actions/photoActions";
import { ObjectPhoto } from "@/types/objectPhoto";
import AddPhotoForm from "./AddPhotoForm";

type Props = {
  photos: ObjectPhoto[];
  objectId: number;
};

export default function ObjectPhotos({
  photos,
  objectId,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Фото</h2>

        <button
          type="button"
          onClick={() => setShowForm((previous) => !previous)}
          className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          {showForm ? "Закрити" : "+ Додати фото"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-gray-50 p-4">
          <AddPhotoForm
            objectId={objectId}
            onUploaded={() => setShowForm(false)}
          />
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-gray-500">
          Фото ще не завантажені.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="overflow-hidden rounded-xl border bg-white"
            >
              <a
                href={photo.public_url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden"
              >
                <img
                  src={photo.public_url}
                  alt={photo.caption || "Фото об’єкта"}
                  className="h-56 w-full object-cover transition duration-200 hover:scale-105"
                />
              </a>

              <div className="p-4">
                {photo.caption ? (
                  <p className="mb-3 text-sm text-gray-700">
                    {photo.caption}
                  </p>
                ) : (
                  <p className="mb-3 text-sm text-gray-400">
                    Без підпису
                  </p>
                )}

                <form
                  action={deleteObjectPhoto.bind(
                    null,
                    photo.id,
                    objectId
                  )}
                  onSubmit={(event) => {
                    const confirmed = window.confirm(
                      "Видалити цю фотографію?"
                    );

                    if (!confirmed) {
                      event.preventDefault();
                    }
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Видалити
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
