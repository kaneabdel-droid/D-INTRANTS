import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getLocale } from "@/dictionaries";

import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "D-INTRANTS — Gestion de Boutique d'Intrants",
  description: "SaaS de gestion de Boutique d'intrants en Afrique avec mode hors-ligne",
  manifest: "/manifest.json"
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col`}>
        <RegisterServiceWorker />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
