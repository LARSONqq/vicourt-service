import type { Metadata } from "next";
import "./globals.css";

import AppShell from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "ViCourt Service",
  description:
    "CRM для ландшафтної компанії",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>
        <AppShell
          sidebar={<Sidebar />}
          header={<Header />}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}