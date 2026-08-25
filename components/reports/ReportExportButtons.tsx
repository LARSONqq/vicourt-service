export type ReportExportItem = {
  title: string;
  href: string;
  note?: string;
};

export type ReportExportGroup = {
  title: string;
  description: string;
  items: ReportExportItem[];
};

export type ReportExportButtonsProps = {
  groups: ReportExportGroup[];
};

export default function ReportExportButtons({
  groups,
}: ReportExportButtonsProps) {
  return (
    <section className="min-w-0 rounded-xl border bg-white p-4 sm:p-5">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">
          Експорт даних
        </h2>

        <p className="mt-1 text-sm leading-5 text-gray-500">
          Завантаження таблиць у
          форматі CSV
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {groups.map(
          (group) => (
            <div
              key={group.title}
              className="min-w-0"
            >
              <div>
                <h3 className="text-sm font-semibold text-gray-900 sm:text-base">
                  {group.title}
                </h3>

                <p className="mt-0.5 text-xs leading-5 text-gray-500 sm:text-sm">
                  {
                    group.description
                  }
                </p>
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {group.items.map(
                  (item) => (
                    <a
                      key={
                        item.href
                      }
                      href={
                        item.href
                      }
                      className="flex min-h-14 min-w-0 flex-col justify-center rounded-lg border border-green-600 px-4 py-2.5 text-left text-sm font-medium text-green-700 transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:text-center"
                    >
                      <span className="block break-words">
                        {
                          item.title
                        }
                      </span>

                      {item.note && (
                        <span className="mt-0.5 block text-xs font-normal text-gray-500">
                          {
                            item.note
                          }
                        </span>
                      )}
                    </a>
                  )
                )}
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
