"use client";

import {
  Fragment,
  useMemo,
  useState,
} from "react";

import { deleteMaterial } from "@/app/actions/materialActions";

import type { Material } from "@/types/material";
import type { WarehouseItem } from "@/types/warehouseItem";
import type { WarehouseMovement } from "@/types/warehouseMovement";
import type { AppCurrency } from "@/types/appSettings";

import AddMaterialForm from "./AddMaterialForm";
import EditMaterialForm from "./EditMaterialForm";
import ObjectMaterialHistory from "./ObjectMaterialHistory";
import ReturnMaterialForm from "./ReturnMaterialForm";

type Props = {
  materials?: Material[];
  warehouseItems?: WarehouseItem[];
  movements?: WarehouseMovement[];
  objectId: number;
  currency: AppCurrency;
  canViewLedger?: boolean;
  canManage?: boolean;
};

export default function ObjectMaterials({
  materials = [],
  warehouseItems = [],
  movements = [],
  objectId,
  currency,
  canViewLedger = false,
  canManage = false,
}: Props) {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );

  const safeMaterials =
    Array.isArray(materials)
      ? materials
      : [];

  const safeWarehouseItems =
    useMemo(
      () =>
        Array.isArray(
          warehouseItems
        )
          ? warehouseItems
          : [],
      [warehouseItems]
    );

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

  function getWarehouseItem(
    material: Material
  ) {
    if (
      !material.warehouse_item_id
    ) {
      return null;
    }

    return (
      warehouseItemsById.get(
        Number(
          material.warehouse_item_id
        )
      ) || null
    );
  }

  function handleDeleteSubmit(
    event: React.FormEvent<HTMLFormElement>,
    material: Material
  ) {
    const isWarehouseMaterial =
      Boolean(
        material.warehouse_item_id
      );

    const returnText =
      isWarehouseMaterial
        ? "\n\nКількість матеріалу буде повернена на склад."
        : "";

    const confirmed =
      window.confirm(
        `Видалити матеріал «${material.name}»?${returnText}`
      );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-6">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold sm:text-xl">
            Матеріали
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Матеріали, використані на
            цьому об’єкті
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Додано:{" "}
            {safeMaterials.length}
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
              : "+ Додати матеріал"}
          </button>
        )}
      </div>

      {/* ADD FORM */}
      {showForm && (
        <div className="mb-5 min-w-0 rounded-xl border bg-gray-50 p-3 sm:mb-6 sm:p-4">
          <AddMaterialForm
            objectId={
              objectId
            }
            warehouseItems={
              safeWarehouseItems
            }
            onSaved={() =>
              setShowForm(false)
            }
          />
        </div>
      )}

      {/* EMPTY */}
      {safeMaterials.length ===
      0 ? (
        <div className="rounded-xl border border-dashed bg-gray-50/50 p-6 text-center sm:p-8">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400">
            📦
          </div>

          <p className="mt-3 font-medium text-gray-700">
            Матеріалів поки немає
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Додай матеріали, використані
            на цьому об’єкті.
          </p>
        </div>
      ) : (
        <>
          {/* MOBILE CARDS */}
          <div className="space-y-3 md:hidden">
            {safeMaterials.map(
              (material) => {
                const warehouseItem =
                  getWarehouseItem(
                    material
                  );

                const isWarehouseMaterial =
                  Boolean(
                    material.warehouse_item_id
                  );

                return (
                  <Fragment
                    key={material.id}
                  >
                    <article className="min-w-0 rounded-xl border p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-gray-900">
                            {
                              material.name
                            }
                          </h3>

                          <span
                            className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                              isWarehouseMaterial
                                ? "bg-blue-50 text-blue-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {isWarehouseMaterial
                              ? "Зі складу"
                              : "Вручну"}
                          </span>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-xs text-gray-400">
                            Кількість
                          </p>

                          <p className="mt-1 text-lg font-bold text-gray-800">
                            {
                              material.quantity
                            }{" "}
                            {
                              material.unit
                            }
                          </p>
                        </div>
                      </div>

                      {canManage && (
                      <div className="mt-4 grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-2">
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
                          className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                            editingId ===
                            material.id
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "text-blue-600 hover:bg-blue-50"
                          }`}
                        >
                          {editingId ===
                          material.id
                            ? "Закрити"
                            : "Редагувати"}
                        </button>

                        {isWarehouseMaterial ? (
                          <ReturnMaterialForm
                            material={material}
                            objectId={objectId}
                          />
                        ) : (
                          <form
                            action={deleteMaterial.bind(
                              null,
                              material.id,
                              objectId
                            )}
                            onSubmit={(event) =>
                              handleDeleteSubmit(event, material)
                            }
                            className="w-full"
                          >
                            <button
                              type="submit"
                              className="min-h-10 w-full rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                            >
                              Видалити
                            </button>
                          </form>
                        )}
                      </div>
                      )}
                    </article>

                    {editingId ===
                      material.id && (
                      <div className="min-w-0 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
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
                      </div>
                    )}
                  </Fragment>
                );
              }
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[780px]">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-600">
                  <th className="p-4 font-medium">
                    Матеріал
                  </th>

                  <th className="p-4 font-medium">
                    Джерело
                  </th>

                  <th className="p-4 font-medium">
                    Кількість
                  </th>

                  <th className="p-4 font-medium">
                    Одиниця
                  </th>

                  <th className="p-4 text-right font-medium">
                    Дії
                  </th>
                </tr>
              </thead>

              <tbody>
                {safeMaterials.map(
                  (material) => {
                    const warehouseItem =
                      getWarehouseItem(
                        material
                      );

                    const isWarehouseMaterial =
                      Boolean(
                        material.warehouse_item_id
                      );

                    return (
                      <Fragment
                        key={
                          material.id
                        }
                      >
                        <tr className="border-t">
                          <td className="p-4 font-medium">
                            {
                              material.name
                            }
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
                            {
                              material.unit
                            }
                          </td>

                          <td className="p-4">
                            {canManage && (
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
                                {editingId ===
                                material.id
                                  ? "Закрити"
                                  : "Редагувати"}
                              </button>

                              {isWarehouseMaterial ? (
                                <ReturnMaterialForm
                                  material={material}
                                  objectId={objectId}
                                />
                              ) : (
                                <form
                                  action={deleteMaterial.bind(
                                    null,
                                    material.id,
                                    objectId
                                  )}
                                  onSubmit={(event) =>
                                    handleDeleteSubmit(event, material)
                                  }
                                >
                                  <button
                                    type="submit"
                                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                  >
                                    Видалити
                                  </button>
                                </form>
                              )}
                            </div>
                            )}
                          </td>
                        </tr>

                        {editingId ===
                          material.id && (
                          <tr className="border-t">
                            <td
                              colSpan={
                                5
                              }
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
        </>
      )}

      {canViewLedger && (
        <ObjectMaterialHistory
          movements={movements}
          currency={currency}
        />
      )}
    </section>
  );
}
