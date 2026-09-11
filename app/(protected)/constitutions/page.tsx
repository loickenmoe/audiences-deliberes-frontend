import { getTranslations } from "next-intl/server";

import { FileConstitutions } from "@/components/modules/constitutions/file-constitutions";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("constitutions");
  return { title: t("titre") };
}

/** Écran 35 — constitutions de prestataires (SH, juristes). */
export default async function PageConstitutions() {
  const session = await exigerCapacite("consulterConstitutions");
  return <FileConstitutions roles={session.roles} />;
}
