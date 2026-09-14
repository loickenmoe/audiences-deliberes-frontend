import { getTranslations } from "next-intl/server";

import { TableauDeBordExecutif } from "@/components/modules/reporting/tableau-de-bord";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("tableauDeBord");
  return { title: t("titre") };
}

/**
 * Écran 39 — tableau de bord exécutif. Réservé au DJ et à la DJA (#50, backend Q-95) : les
 * indicateurs portent sur l'activité de toute la Direction Juridique, pas sur un portefeuille.
 */
export default async function PageTableauDeBord() {
  const session = await exigerCapacite("consulterTableauDeBord");
  return <TableauDeBordExecutif roles={session.roles} />;
}
