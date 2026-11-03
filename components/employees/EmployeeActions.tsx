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
        className={`min-h-11 w-full rounded-lg px-5 py-3 font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto ${
          showForm
            ? "border border-border bg-card text-foreground hover:bg-muted"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {showForm
          ? "Закрити форму"
          : "+ Додати працівника"}
      </button>

      {showForm && (
        <div className="vc-surface mt-4 min-w-0 p-4 sm:mt-5 sm:p-5">
          <div className="mb-4 sm:mb-5">
            <h2 className="text-base font-semibold text-foreground">
              Новий працівник
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
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
