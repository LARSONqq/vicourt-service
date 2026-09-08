import ActivityTimelineList from "@/components/activity/ActivityTimelineList";

import type {
  EquipmentActivityPage,
} from "@/types/equipmentProfile";

type Props = {
  page: EquipmentActivityPage;
};

export default function EquipmentActivitySection({
  page,
}: Props) {
  return (
    <section className="min-w-0 space-y-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Історія техніки
        </h2>
        <p className="mt-1 text-sm leading-5 text-gray-500">
          Хронологія змін, обслуговування, напрацювання та пов’язаних завдань.
        </p>
      </div>

      {page.items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-white p-6 text-center">
          <p className="font-medium text-gray-700">
            Історія поки порожня
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Нові бізнес-дії з’являться тут автоматично.
          </p>
        </div>
      ) : (
        <ActivityTimelineList
          logs={page.items}
          existingObjectIds={[]}
          compact
        />
      )}
    </section>
  );
}
