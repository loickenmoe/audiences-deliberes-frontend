import { getTranslations } from "next-intl/server";

import { TableauDeBordExecutif } from "@/components/modules/reporting/tableau-de-bord";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("tableauDeBord");
  return { title: t("titre") };
}

/**
 * Screen 39 - executive dashboard. Reserved to the DJ and DJA (#50): the indicators cover the
 * activity of the whole Legal Department, not a single portfolio.
 */
export default async function PageTableauDeBord() {
  const session = await exigerCapacite("consulterTableauDeBord");
  return <TableauDeBordExecutif roles={session.roles} />;
}
