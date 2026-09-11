import { getTranslations } from "next-intl/server";

import { RepertoireAvocats } from "@/components/modules/repertoire/repertoire-avocats";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("repertoire");
  return { title: t("titre") };
}

/** Écran 34 — répertoire des avocats (juristes, Assistante). */
export default async function PageRepertoire() {
  await exigerCapacite("consulterRepertoire");
  return <RepertoireAvocats />;
}
