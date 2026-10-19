import { getTranslations } from "next-intl/server";

import { JournalAudiences } from "@/components/modules/audiences/journal-audiences";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("journalAudiences");
  return { title: t("titre") };
}

/**
 * Screen 44 - hearings log and expected hearing reports.
 *
 * Reserved to the DJ and DJA: the screen names people and measures what they have reported.
 */
export default async function PageJournalAudiences() {
  await exigerCapacite("consulterJournalAudiences");
  return <JournalAudiences />;
}
