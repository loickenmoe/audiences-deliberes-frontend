import { getTranslations } from "next-intl/server";

import { ListeAgences } from "@/components/modules/administration/liste-agences";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("agences");
  return { title: t("titre") };
}

/**
 * Agency reference data.
 *
 * Readable by every internal profile (it explains what the case creation form offers). Creating,
 * correcting and closing agencies is reserved to the DJ and DJA, and hidden from everyone else.
 */
export default async function PageAgences() {
  const session = await exigerCapacite("consulterReferentiels");
  return <ListeAgences roles={session.roles} />;
}
