import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { AppProvider } from "@/providers";

import "./globals.css";

/**
 * QF-09 (révisé) : **français et anglais**, les deux langues officielles du Cameroun. La langue
 * active vient d'un cookie ; l'URL ne porte aucun préfixe, afin que les liens profonds des
 * notifications restent valables d'un utilisateur à l'autre.
 *
 * Typographie sans empattement, conformément à l'usage des applications internes de la banque.
 * Le mono sert aux données alignées : références de dossier, montants, codes d'erreur.
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
 * La session est lue **ici**, côté serveur, et transmise au fournisseur (QF-42).
 *
 * Sans elle, `SessionProvider` interroge `/api/auth/session` au montage de chaque page — et chaque
 * lecture **repose le cookie de session**. Une déconnexion tombant pendant l'une d'elles était
 * annulée : la réponse revenait après et réécrivait le cookie qu'elle venait d'effacer. La session
 * étant déjà résolue par le rendu serveur, cet aller-retour n'apportait rien.
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
