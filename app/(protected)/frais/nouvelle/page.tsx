import { getTranslations } from "next-intl/server";

import { FormulaireFrais } from "@/components/modules/portail/formulaire-frais";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("fraisTitre") };
}

/** Screen 30 - expense request submission by the lawyer (#23, US 4.1). */
export default async function PageNouvelleDemandeFrais() {
  await exigerCapacite("deposerFrais");
  return <FormulaireFrais />;
}
