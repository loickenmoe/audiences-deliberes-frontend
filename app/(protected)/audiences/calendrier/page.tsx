import { getTranslations } from "next-intl/server";

import { CalendrierAudiences } from "@/components/modules/audiences/calendrier-audiences";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("calendrier");
  return { title: t("titre") };
}

/**
 * Screen 22 - hearings calendar.
 *
 * `GET /audiences/calendrier` is reserved to legal officers and the DJ (not the DJA, assistant, SH
 * or lawyer). The guard is applied here, before any rendering.
 */
export default async function PageCalendrier() {
  await exigerCapacite("consulterCalendrier");
  return <CalendrierAudiences />;
}
