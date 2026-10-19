import { getTranslations } from "next-intl/server";

import { FilePartages } from "@/components/modules/ged/file-partages";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("partages");
  return { title: t("titre") };
}

/**
 * Document shares proposed on sensitive cases, validated by the DJ and DJA.
 * The backend refuses the queue to any other profile (`GET /ged/partages-avocat`); the page guard
 * only avoids showing a screen bound to be refused.
 */
export default async function PagePartagesAvocat() {
  await exigerCapacite("arbitrerPartages");
  return <FilePartages />;
}
