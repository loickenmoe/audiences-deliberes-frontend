import { getTranslations } from "next-intl/server";

import { FileFrais } from "@/components/modules/frais/file-frais";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("frais");
  return { title: t("titre") };
}

/** Écran 28 — file des demandes de frais (Assistante, DJA, DJ ; l'avocat n'y voit que les siennes). */
export default async function PageFrais() {
  const session = await exigerCapacite("consulterFrais");
  return <FileFrais roles={session.roles} />;
}
