import { getTranslations } from "next-intl/server";

import { JournalAudiences } from "@/components/modules/audiences/journal-audiences";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("journalAudiences");
  return { title: t("titre") };
}

/**
 * Écran 44 — journal des audiences et comptes rendus attendus (observation métier du 2026-09-25).
 *
 * Réservé au DJ et à la DJA : l'écran nomme des personnes et mesure ce qu'elles ont rapporté.
 */
export default async function PageJournalAudiences() {
  await exigerCapacite("consulterJournalAudiences");
  return <JournalAudiences />;
}
