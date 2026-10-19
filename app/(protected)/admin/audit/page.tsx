import { getTranslations } from "next-intl/server";

import { ConsultationAudit } from "@/components/modules/audit/consultation-audit";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("audit");
  return { title: t("titre") };
}

/**
 * Screen 43 - audit of recorded actions. DJ and DJA only.
 *
 * Separate from Configuration because investigating (going back in time, crossing author, period
 * and nature) is a different task from administering settings. The guard is `consulterAudit`,
 * **distinct** from `administrerConfigurations`: reading a colleague's named activity is not
 * writing a threshold, and relaxing one must not move the other.
 */
export default async function PageAudit() {
  await exigerCapacite("consulterAudit");
  return <ConsultationAudit />;
}
