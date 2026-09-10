import { getTranslations } from "next-intl/server";

import { CalendrierAudiences } from "@/components/modules/audiences/calendrier-audiences";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("calendrier");
  return { title: t("titre") };
}

/**
 * Écran 22 — calendrier des audiences.
 *
 * `GET /audiences/calendrier` est réservé au juriste et au DJ : ni le DJA, ni l'Assistante, ni le SH,
 * ni l'avocat. La garde est posée ici, avant tout rendu.
 */
export default async function PageCalendrier() {
  await exigerCapacite("consulterCalendrier");
  return <CalendrierAudiences />;
}
