import { getTranslations } from "next-intl/server";

import { BaseJurisprudentielle } from "@/components/modules/jurisprudence/base-jurisprudentielle";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("jurisprudence");
  return { title: t("titre") };
}

/** Screen 38 - case law base: readable by all internal profiles, archiving by legal officers. */
export default async function PageJurisprudences() {
  const session = await exigerCapacite("consulterJurisprudence");
  return <BaseJurisprudentielle roles={session.roles} />;
}
