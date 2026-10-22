import { getTranslations } from "next-intl/server";

import { RapportJournalierGed } from "@/components/modules/ged/rapport-journalier";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("rapportJournalier");
  return { title: t("titre") };
}

/** Screen 37 - daily document management report: legal officers, DJ, DJA and assistant. */
export default async function PageRapportJournalier() {
  await exigerCapacite("consulterRapportJournalier");
  return <RapportJournalierGed />;
}
