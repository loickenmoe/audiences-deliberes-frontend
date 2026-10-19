import { getTranslations } from "next-intl/server";

import { FileFrais } from "@/components/modules/frais/file-frais";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("frais");
  return { title: t("titre") };
}

/** Screen 28 - expense request queue (assistant, DJA, DJ; the lawyer only sees their own). */
export default async function PageFrais() {
  const session = await exigerCapacite("consulterFrais");
  return <FileFrais roles={session.roles} />;
}
