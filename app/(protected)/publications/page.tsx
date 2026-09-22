import { getTranslations } from "next-intl/server";

import { FilePublications } from "@/components/modules/publications/file-publications";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("publications");
  return { title: t("titre") };
}

/** Écran 31 — publications des avocats (Assistante, juristes, DJ, DJA). */
export default async function PagePublications() {
  const session = await exigerCapacite("consulterPublications");
  return <FilePublications roles={session.roles} />;
}
