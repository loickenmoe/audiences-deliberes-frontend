import { getTranslations } from "next-intl/server";

import { FilePublications } from "@/components/modules/publications/file-publications";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("publications");
  return { title: t("titre") };
}

/** Screen 31 - lawyers' publications (assistant, legal officers, DJ, DJA). */
export default async function PagePublications() {
  const session = await exigerCapacite("consulterPublications");
  return <FilePublications roles={session.roles} />;
}
