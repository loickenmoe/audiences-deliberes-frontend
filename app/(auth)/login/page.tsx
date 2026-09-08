import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Logo, SelecteurLangue } from "@/components/global";
import { FormulaireConnexion } from "@/components/modules/auth/formulaire-connexion";
import { auth } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("connexion");
  return { title: t("titre") };
}

/**
 * Écran de connexion.
 *
 * Composition reprise de **GFA**, application Afriland en production : carte blanche centrée sur
 * fond gris clair, lockup horizontal, formule de bienvenue, sous-titre développant l'intitulé,
 * action pleine largeur, pied de page de copyright.
 *
 * **Page non défilable** : `h-svh` avec `overflow-hidden`. Un écran de connexion tient dans une
 * fenêtre — le faire défiler donnerait l'impression qu'il manque quelque chose. Les espacements
 * sont resserrés en conséquence, pour que le contenu tienne sur les hauteurs d'écran courantes.
 *
 * Le sélecteur de langue est présent **avant** la connexion : un utilisateur anglophone doit
 * pouvoir basculer sans avoir à deviner le français.
 */
export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const session = await auth();
  if (session?.user && !session.erreur) redirect("/");

  const t = await getTranslations("connexion");
  const tc = await getTranslations("commun");
  const { motif } = await searchParams;
  const message = motif === "session-expiree" ? t("sessionExpiree") : null;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <div className="flex justify-end px-6 pt-4">
        <SelecteurLangue />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 py-3">
        <div className="w-full max-w-[25rem]">
          <div className="rounded-lg border border-bordure bg-surface px-8 py-7 shadow-[var(--ombre-carte)]">
            <div className="flex justify-center">
              <Logo hauteur={32} />
            </div>

            <div className="mt-5 flex flex-col items-center gap-1 text-center">
              <h1 className="text-balance text-[length:var(--taille-xl)] font-semibold tracking-tight">
                {t("bienvenue")}
              </h1>
              <p className="text-pretty text-[length:var(--taille-sm)] text-texte-secondaire">
                {t("sousTitre")}
              </p>
            </div>

            <FormulaireConnexion messageInitial={message} />

            <p className="mt-4 text-center text-[length:var(--taille-xs)] leading-relaxed text-texte-tertiaire">
              {t("mention")}
            </p>
          </div>

          <p className="mt-4 text-center text-[length:var(--taille-xs)] text-texte-tertiaire">
            {tc("copyright", { annee: new Date().getFullYear() })}
          </p>
        </div>
      </main>
    </div>
  );
}
