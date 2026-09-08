import { getTranslations } from "next-intl/server";

import { StatutChip } from "@/components/global";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CAPACITES, type Capacite, peut, profilPrincipal } from "@/lib/rbac";
import { exigerSession } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("accueil");
  return { title: t("titre") };
}

/**
 * Accueil.
 *
 * **QF-19** : une seule racine pour tous les profils, dont le contenu s'adapte — pas de redirection
 * par rôle. Aucun profil interne n'a de métier unique. Les files de travail par profil seront
 * greffées ici au fil des jalons métier ; voir `SCREEN_MAP.md`, écran 02.
 */
export default async function PageAccueil() {
  const session = await exigerSession();
  const t = await getTranslations("accueil");
  const tc = await getTranslations("commun");
  const tr = await getTranslations("roles");

  const profil = profilPrincipal(session.roles);
  const capacites = (Object.keys(CAPACITES) as Capacite[]).filter((c) => peut(session.roles, c));
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("rolesTitre")}</CardTitle>
            <CardDescription>{t("rolesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {session.roles.map((role) => (
              <StatutChip key={role} ton={role === profil ? "info" : "neutre"}>
                {tr(role)}
              </StatutChip>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("droitsTitre")}</CardTitle>
            <CardDescription>
              {t("droitsDescription", {
                accordees: capacites.length,
                total: Object.keys(CAPACITES).length,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-[length:var(--taille-sm)] text-texte-secondaire">
              {capacites.map((capacite) => (
                <li key={capacite} className="font-mono text-[length:var(--taille-xs)]">
                  {capacite}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
