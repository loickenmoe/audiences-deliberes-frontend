import { getTranslations } from "next-intl/server";

import { ListeIntervenants } from "@/components/modules/intervenants/liste-intervenants";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("intervenants");
  return { title: t("titre") };
}

/**
 * Écran 42 — référentiel des intervenants.
 *
 * Consultation ouverte à tous les profils internes (#62, `ROLE_CONSULTATION`) ; la création est
 * réservée au DJ et au DJA (#61) et masquée pour les autres.
 */
export default async function PageIntervenants() {
  const session = await exigerCapacite("consulterReferentiels");
  return <ListeIntervenants roles={session.roles} />;
}
