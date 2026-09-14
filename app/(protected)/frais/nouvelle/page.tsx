import { getTranslations } from "next-intl/server";

import { FormulaireFrais } from "@/components/modules/portail/formulaire-frais";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("fraisTitre") };
}

/** Écran 30 — dépôt d'une demande de frais par l'avocat (#23, US 4.1). */
export default async function PageNouvelleDemandeFrais() {
  await exigerCapacite("deposerFrais");
  return <FormulaireFrais />;
}
