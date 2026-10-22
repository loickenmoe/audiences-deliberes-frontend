import { getTranslations } from "next-intl/server";

import { EspaceAvocat } from "@/components/modules/portail/espace-avocat";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("espaceTitre") };
}

/**
 * Lawyer's space: their submissions, appointment letters and **their activity**. Reserved to
 * `ROLE_AVOCAT`; internal profiles have their own queues.
 *
 * Their activity is here, not on "My account", because that screen holds "My signature" (irrelevant
 * to them) and requires `ROLE_CONSULTATION`, which they lack.
 *
 * Detail rows deliberately link to no case: the lawyer has no case file screen, and the reference
 * is how they name their matters anyway.
 */
export default async function PagePortail() {
  await exigerCapacite("deposerPublication");
  return (
    <div className="flex flex-col gap-6">
      <EspaceAvocat />
      <FicheActivite lienVersDossier={false} />
    </div>
  );
}
