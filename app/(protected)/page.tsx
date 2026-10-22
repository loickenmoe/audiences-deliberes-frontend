import { getTranslations } from "next-intl/server";

import { FilesDuJour } from "@/components/modules/accueil/files-du-jour";
import { profilPrincipal } from "@/lib/rbac";
import { exigerSession } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("accueil");
  return { title: t("titre") };
}

/**
 * Home.
 *
 * A single root for all profiles, with content adapted to each, and no role-based redirect: no
 * internal profile has a single job. It shows each profile's **work queues** with counts and direct links.
 */
export default async function PageAccueil() {
  const session = await exigerSession();
  const t = await getTranslations("accueil");
  const tc = await getTranslations("commun");
  const tr = await getTranslations("roles");

  const profil = profilPrincipal(session.roles);
  const prenom = session.user.prenom?.trim();

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[length:var(--taille-2xs)] uppercase tracking-[0.13em] text-texte-tertiaire">
          {profil ? tr(profil) : tc("profilInconnu")}
        </p>
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {prenom ? t("bonjour", { prenom }) : t("bonjourSansPrenom")}
        </h1>
        <p className="text-texte-secondaire">{t("sessionActive")}</p>
      </header>

      <FilesDuJour roles={session.roles} />
    </div>
  );
}
