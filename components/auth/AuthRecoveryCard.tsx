import type { ReactNode } from "react";

export function AuthRecoveryCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:px-6">
    <section className="vc-surface w-full max-w-md min-w-0 p-5 sm:p-8" aria-labelledby="auth-recovery-title">
      <header className="mb-7 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 id="auth-recovery-title" className="vc-page-title mt-2 break-words">{title}</h1>
        <p className="vc-muted mt-2">{description}</p>
      </header>
      {children}
      <p className="mt-7 text-center text-xs text-muted-foreground">ViCourt Service</p>
    </section>
  </main>;
}
