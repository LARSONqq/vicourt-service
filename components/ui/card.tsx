import { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b p-5">
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-lg font-semibold">
      {children}
    </h2>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return (
    <div className="p-5">
      {children}
    </div>
  );
}
