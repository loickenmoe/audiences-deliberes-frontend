import { getTranslations } from "next-intl/server";

import { FilePartages } from "@/components/modules/ged/file-partages";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("partages");
  return { title: t("titre") };
}

/**
 * QF-64 — les partages de pièces proposés sur des dossiers sensibles, que le DJ et la DJA valident.
 * Le backend refuse la file à tout autre profil (`GET /ged/partages-avocat`) ; la garde de page
 * évite seulement d'afficher un écran voué au refus.
 */
export default async function PagePartagesAvocat() {
  await exigerCapacite("arbitrerPartages");
  return <FilePartages />;
}
