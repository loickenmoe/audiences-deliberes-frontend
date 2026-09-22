import { getTranslations } from "next-intl/server";

import { FileSuppressions } from "@/components/modules/ged/file-suppressions";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("suppressions");
  return { title: t("titre") };
}

/** Écran 36 — demandes de suppression de documents, réservé au DJ et à la DJA. */
export default async function PageDemandesSuppression() {
  await exigerCapacite("arbitrerSuppressions");
  return <FileSuppressions />;
}
