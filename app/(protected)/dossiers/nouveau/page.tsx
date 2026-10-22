import { getTranslations } from "next-intl/server";

import { FormulaireDossier } from "@/components/modules/dossiers/formulaire-dossier";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("dossiers");
  return { title: t("creerTitre") };
}

/**
 * Screen 06 - case creation.
 *
 * `POST /dossiers` requires `ROLE_SAISIE`: the guard is applied here, before rendering, rather than
 * letting the user fill twenty fields only to be refused on submit.
 */
export default async function PageNouveauDossier() {
  const session = await exigerCapacite("creerDossier");
  return <FormulaireDossier courrielUtilisateur={session.user?.email ?? null} />;
}
