import { getTranslations } from "next-intl/server";

import { FormulairePublication } from "@/components/modules/portail/formulaire-publication";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("publicationTitre") };
}

/** Screen 33 - submission of a hearing report (#29) or another publication (#31). */
export default async function PageNouvellePublication() {
  await exigerCapacite("deposerPublication");
  return <FormulairePublication />;
}
