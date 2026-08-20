"use client";

import { useState } from "react";

import AddEmployeeForm from "./AddEmployeeForm";

export default function EmployeeActions() {
  const [
    showForm,
    setShowForm,
  ] = useState(false);

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() =>
          setShowForm(
            (current) =>
              !current
          )
        }
        className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium transition sm:w-auto ${
          showForm
            ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {showForm
          ? "Закрити форму"
          : "+ Додати працівника"}
      </button>

      {showForm && (
        <div className="mt-4 min-w-0 rounded-xl border bg-white p-4 sm:mt-5 sm:p-5">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
              Новий працівник
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Додай працівника до
              команди та заповни його
              основну інформацію.
            </p>
          </div>

          <AddEmployeeForm
            onCreated={() =>
              setShowForm(
                false
              )
            }
          />
        </div>
      )}
    </div>
  );
}