import type {
  Metadata,
  Viewport,
} from "next";
import "./globals.css";

import AppShell from "@/components/layout/AppShell";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import PWARegister from "@/components/pwa/PWARegister";
import { getAccountIdentity } from "@/services/accountIdentityService";

export const metadata: Metadata = {
  title: "ViCourt Service",
  description:
    "Система керування об’єктами, завданнями, складом і роботою команди.",
  applicationName: "ViCourt",
  manifest:
    "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        type: "image/x-icon",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "ViCourt",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#166534",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const identity = await getAccountIdentity();
  return (
    <html lang="uk">
      <body>
        <PWARegister />

        {identity === "internal" ? <AppShell
          sidebar={<Sidebar />}
          header={<Header />}
        >
          {children}
        </AppShell> : children}
      </body>
    </html>
  );
}
