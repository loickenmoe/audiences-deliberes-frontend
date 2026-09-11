import { getTranslations } from "next-intl/server";

import { BaseJurisprudentielle } from "@/components/modules/jurisprudence/base-jurisprudentielle";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("jurisprudence");
  return { title: t("titre") };
}

/** Écran 38 — base jurisprudentielle : consultation par tous les profils internes, archivage par le juriste. */
export default async function PageJurisprudences() {
  const session = await exigerCapacite("consulterJurisprudence");
  return <BaseJurisprudentielle roles={session.roles} />;
}
