"use client";

import { deleteObject } from "@/app/actions/objectActions";

type Props = {
  objectId: number;
  objectName: string;
};

export default function DeleteObjectButton({
  objectId,
  objectName,
}: Props) {
  return (
    <form
      action={deleteObject.bind(null, objectId)}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Видалити об’єкт «${objectName}»?\n\nМатеріали, журнал робіт і фотографії також буде видалено.`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Видалити об’єкт
      </button>
    </form>
  );
}
