import { getTranslations } from "next-intl/server";

import { FormulairePublication } from "@/components/modules/portail/formulaire-publication";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("publicationTitre") };
}

/** Écran 33 — dépôt d'un compte rendu d'audience (#29) ou d'une autre publication (#31). */
export default async function PageNouvellePublication() {
  await exigerCapacite("deposerPublication");
  return <FormulairePublication />;
}
