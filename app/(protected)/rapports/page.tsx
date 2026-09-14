import { getTranslations } from "next-intl/server";

import { FormulaireRapport } from "@/components/modules/reporting/formulaire-rapport";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("rapports");
  return { title: t("titre") };
}

/**
 * Écran 40 — rapport d'activité. `GET /rapports` est `hasRole('JURISTE')` (#49) : le juriste y
 * accède directement, le DJ et la DJA par leur composite `ROLE_JURISTE` (backend Q-81). C'est ce
 * qui rend le parcours de pilotage P9 jouable d'un bout à l'autre et ferme QF-04.
 */
export default async function PageRapports() {
  await exigerCapacite("genererRapport");
  return <FormulaireRapport />;
}
