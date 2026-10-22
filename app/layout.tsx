import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { AppProvider } from "@/providers";

import "./globals.css";

/**
 * French and English, Cameroon's two official languages. The active language comes from a cookie;
 * URLs carry no prefix so notification deep links stay valid from one user to another.
 *
 * Sans-serif typography, as in the bank's internal applications. Monospace is for aligned data:
 * case references, amounts, error codes.
 */
const sans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("commun");
  return {
    title: { default: t("application"), template: `%s · ${t("application")}` },
    description: `${t("direction")} - ${t("organisation")}`,
    icons: { icon: "/brand/symbole-afriland.svg" },
  };
}

/**
 * The session is read **here**, server side, and passed to the provider.
 *
 * Otherwise `SessionProvider` queries `/api/auth/session` on every page mount, and each read
 * **re-sets the session cookie**: a read in flight during logout could rewrite the cookie logout
 * had just cleared.
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, session] = await Promise.all([getLocale(), auth()]);

  return (
    <html lang={locale}>
      <body className={`${sans.variable} ${mono.variable}`}>
        <NextIntlClientProvider>
          <AppProvider session={session}>{children}</AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
