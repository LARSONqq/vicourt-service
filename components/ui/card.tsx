import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className, ...props }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("vc-surface", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border px-4 py-4 sm:px-5">
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="vc-section-title">
      {children}
    </h2>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 sm:p-5">
      {children}
    </div>
  );
}
