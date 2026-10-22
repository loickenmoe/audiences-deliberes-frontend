import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Logo, SelecteurLangue } from "@/components/global";
import { FormulaireConnexion } from "@/components/modules/auth/formulaire-connexion";
import { MotifConsomme } from "@/components/modules/auth/motif-consomme";
import { auth } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("connexion");
  return { title: t("titre") };
}

/**
 * Login screen.
 *
 * Layout borrowed from GFA, an Afriland application in production: centred white card on a light
 * grey background, horizontal lockup, welcome line, full-width action, copyright footer.
 *
 * The page does not scroll (`h-svh` + `overflow-hidden`): a login screen fits in one window, so
 * spacing is tightened to fit common screen heights. The language switcher is shown **before**
 * login so an English speaker never has to guess the French.
 */
export default async function PageConnexion({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ motif?: string }>;
}>) {
  const session = await auth();
  if (session?.user && !session.erreur) redirect("/");

  const t = await getTranslations("connexion");
  const tc = await getTranslations("commun");
  /*
   * The reason describes an event, not a page state: it is shown once, then **removed from the URL**
   * by `MotifConsomme` so a reload or tab restore does not announce an expiry to someone who had no
   * session. A rejected token calls for signing in again; an unreachable auth service calls for patience.
   */
  const { motif } = await searchParams;
  let message: string | null = null;
  if (motif === "session-expiree") message = t("sessionExpiree");
  else if (motif === "auth-indisponible") message = t("authIndisponible");

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
            {message ? <MotifConsomme /> : null}

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
