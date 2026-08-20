type Props = {
  activeTasks: number;
  materialsCount: number;
  totalHours: number;
  photosCount: number;
};

export default function ObjectSummary({
  activeTasks,
  materialsCount,
  totalHours,
  photosCount,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
        <p className="text-xs text-gray-500 sm:text-sm">
          Активні завдання
        </p>

        <p className="mt-2 text-2xl font-bold text-yellow-600">
          {activeTasks}
        </p>
      </div>

      <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
        <p className="text-xs text-gray-500 sm:text-sm">
          Матеріали
        </p>

        <p className="mt-2 text-2xl font-bold text-gray-900">
          {materialsCount}
        </p>
      </div>

      <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
        <p className="text-xs text-gray-500 sm:text-sm">
          Відпрацьовано годин
        </p>

        <p className="mt-2 break-words text-2xl font-bold text-green-600">
          {totalHours}
        </p>
      </div>

      <div className="min-w-0 rounded-xl border bg-white p-3 sm:p-4">
        <p className="text-xs text-gray-500 sm:text-sm">
          Фотографії
        </p>

        <p className="mt-2 text-2xl font-bold text-gray-900">
          {photosCount}
        </p>
      </div>
    </div>
  );
}