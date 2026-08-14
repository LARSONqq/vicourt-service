"use client";

import { useState } from "react";
import AddEmployeeForm from "./AddEmployeeForm";

export default function EmployeeActions() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShowForm((current) => !current)}
        className="rounded-lg bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700"
      >
        {showForm ? "Закрити" : "+ Додати працівника"}
      </button>

      {showForm && (
        <div className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="mb-5 text-xl font-semibold">
            Новий працівник
          </h2>

          <AddEmployeeForm
            onCreated={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}