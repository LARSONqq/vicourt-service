"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";
import { deleteMaterial } from "@/app/actions/materialActions";
import type { Material } from "@/types/material";
import type { WarehouseItem } from "@/types/warehouseItem";
import AddMaterialForm from "./AddMaterialForm";
import EditMaterialForm from "./EditMaterialForm";

type Props = {
  materials?: Material[];
  warehouseItems?: WarehouseItem[];
  objectId: number;
};

export default function ObjectMaterials({
  materials = [],
  warehouseItems = [],
  objectId,
}: Props) {
  const [showForm, setShowForm] =
    useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(null);

  const safeMaterials =
    Array.isArray(materials)
      ? materials
      : [];

  const safeWarehouseItems =
    Array.isArray(warehouseItems)
      ? warehouseItems
      : [];

  const warehouseItemsById =
    useMemo(() => {
      return new Map(
        safeWarehouseItems.map(
          (item) => [
            Number(item.id),
            item,
          ]
        )
      );
    }, [safeWarehouseItems]);

  return (
    <section className="rounded-xl border bg-white p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Матеріали
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Матеріали, використані на
            цьому об’єкті
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowForm(
              (previous) => !previous
            )
          }
          className="w-fit rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
        >
          {showForm
            ? "Закрити"
            : "+ Додати матеріал"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-gray-50 p-4">
          <AddMaterialForm
            objectId={objectId}
            warehouseItems={
              safeWarehouseItems
            }
            onSaved={() =>
              setShowForm(false)
            }
          />
        </div>
      )}

      {safeMaterials.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-gray-500">
            Матеріали ще не додані.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[780px]">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="p-4">
                  Матеріал
                </th>

                <th className="p-4">
                  Джерело
                </th>

                <th className="p-4">
                  Кількість
                </th>

                <th className="p-4">
                  Одиниця
                </th>

                <th className="p-4 text-right">
                  Дії
                </th>
              </tr>
            </thead>

            <tbody>
              {safeMaterials.map(
                (material) => {
                  const warehouseItem =
                    material.warehouse_item_id
                      ? warehouseItemsById.get(
                          Number(
                            material.warehouse_item_id
                          )
                        ) || null
                      : null;

                  const isWarehouseMaterial =
                    Boolean(
                      material.warehouse_item_id
                    );

                  return (
                    <Fragment
                      key={material.id}
                    >
                      <tr className="border-t">
                        <td className="p-4 font-medium">
                          {material.name}
                        </td>

                        <td className="p-4">
                          {isWarehouseMaterial ? (
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                              Зі складу
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                              Вручну
                            </span>
                          )}
                        </td>

                        <td className="p-4 font-medium">
                          {
                            material.quantity
                          }
                        </td>

                        <td className="p-4">
                          {material.unit}
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(
                                  editingId ===
                                    material.id
                                    ? null
                                    : material.id
                                )
                              }
                              className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Редагувати
                            </button>

                            <form
                              action={deleteMaterial.bind(
                                null,
                                material.id,
                                objectId
                              )}
                              onSubmit={(
                                event
                              ) => {
                                const returnText =
                                  isWarehouseMaterial
                                    ? "\n\nКількість матеріалу буде повернена на склад."
                                    : "";

                                const confirmed =
                                  window.confirm(
                                    `Видалити матеріал «${material.name}»?${returnText}`
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
                                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Видалити
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>

                      {editingId ===
                        material.id && (
                        <tr className="border-t">
                          <td
                            colSpan={5}
                            className="p-4"
                          >
                            <EditMaterialForm
                              material={
                                material
                              }
                              objectId={
                                objectId
                              }
                              warehouseItem={
                                warehouseItem
                              }
                              onCancel={() =>
                                setEditingId(
                                  null
                                )
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}