import { getTranslations } from "next-intl/server";

import { FormulaireDossier } from "@/components/modules/dossiers/formulaire-dossier";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("dossiers");
  return { title: t("creerTitre") };
}

/**
 * Écran 06 — création d'un dossier.
 *
 * `POST /dossiers` exige `ROLE_SAISIE` : la garde est posée ici, avant tout rendu, plutôt que de
 * laisser l'utilisateur remplir vingt champs pour se voir refuser à l'envoi.
 */
export default async function PageNouveauDossier() {
  await exigerCapacite("creerDossier");
  return <FormulaireDossier />;
}
