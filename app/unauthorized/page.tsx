import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/global";
import { classesBouton } from "@/components/ui/button";

export async function generateMetadata() {
  const t = await getTranslations("pages");
  return { title: t("refusCode") };
}

export default async function PageNonAutorise() {
  const t = await getTranslations("pages");

  return (
    <div className="flex min-h-svh flex-col justify-center">
      <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center gap-4 px-6 text-center">
        <div className="flex justify-center">
          <Logo hauteur={30} />
        </div>
        <p className="mt-4 font-mono text-[length:var(--taille-2xs)] uppercase tracking-[0.13em] text-texte-tertiaire">
          {t("refusCode")}
        </p>
        <h1 className="text-balance text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("refusTitre")}
        </h1>
        <p className="text-texte-secondaire">{t("refusTexte")}</p>
        <div className="mt-2 flex justify-center">
          <Link href="/" className={classesBouton({ variante: "secondaire" })}>
            {t("retourAccueil")}
          </Link>
        </div>
      </main>
    </div>
  );
}
