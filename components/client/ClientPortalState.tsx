import { CircleAlert, Leaf } from "lucide-react";

// Presentation only: safe public copy, no errors or account/data objects.
export default function ClientPortalState({ title, description, error = false, children }: {
  title: string;
  description?: string;
  error?: boolean;
  children?: React.ReactNode;
}) {
  const Icon = error ? CircleAlert : Leaf;
  return <div role="status" className="min-w-0 rounded-xl bg-gray-50 p-5 [overflow-wrap:anywhere] sm:p-6">
    <Icon aria-hidden="true" className={`mb-3 size-6 ${error ? "text-amber-700" : "text-green-700"}`} />
    <p className="text-sm font-medium leading-relaxed text-gray-800">{title}</p>
    {description && <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>}
    {children && <div className="mt-4">{children}</div>}
  </div>;
}
