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
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-gray-500">Активні завдання</p>
        <p className="mt-2 text-2xl font-bold text-yellow-600">
          {activeTasks}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-gray-500">Матеріали</p>
        <p className="mt-2 text-2xl font-bold">{materialsCount}</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-gray-500">Відпрацьовано годин</p>
        <p className="mt-2 text-2xl font-bold text-green-600">
          {totalHours}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-gray-500">Фотографії</p>
        <p className="mt-2 text-2xl font-bold">{photosCount}</p>
      </div>
    </div>
  );
}
