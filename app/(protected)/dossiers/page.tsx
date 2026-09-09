import { getTranslations } from "next-intl/server";

import { ListeDossiers } from "@/components/modules/dossiers/liste-dossiers";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("dossiers");
  return { title: t("titre") };
}

/**
 * Écran 05 — recherche de dossiers.
 *
 * La garde est côté serveur : `GET /dossiers` exige `ROLE_CONSULTATION`, que l'avocat ne porte pas.
 */
export default async function PageDossiers() {
  const session = await exigerCapacite("consulterDossiers");
  return <ListeDossiers roles={session.roles} />;
}
