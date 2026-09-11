import { getTranslations } from "next-intl/server";

import { RapportJournalierGed } from "@/components/modules/ged/rapport-journalier";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("rapportJournalier");
  return { title: t("titre") };
}

/** Écran 37 — rapport journalier GED : juriste, DJ, DJA et Assistante (Q-80 backend). */
export default async function PageRapportJournalier() {
  await exigerCapacite("consulterRapportJournalier");
  return <RapportJournalierGed />;
}
