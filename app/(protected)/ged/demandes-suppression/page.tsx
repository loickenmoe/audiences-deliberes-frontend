import { getTranslations } from "next-intl/server";

import { FileSuppressions } from "@/components/modules/ged/file-suppressions";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("suppressions");
  return { title: t("titre") };
}

/** Screen 36 - document deletion requests, reserved to the DJ and DJA. */
export default async function PageDemandesSuppression() {
  await exigerCapacite("arbitrerSuppressions");
  return <FileSuppressions />;
}
