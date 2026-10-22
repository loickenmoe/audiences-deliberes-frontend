import { getTranslations } from "next-intl/server";

import { RepertoireAvocats } from "@/components/modules/repertoire/repertoire-avocats";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("repertoire");
  return { title: t("titre") };
}

/**
 * Screen 34 - lawyers directory (legal officers, assistant).
 *
 * Only the DJ and DJA can open a lawyer's **activity sheet**. The server enforces it (hiding is not
 * securing), but the screen should not offer a door that leads to a wall.
 */
export default async function PageRepertoire() {
  const session = await exigerCapacite("consulterRepertoire");
  return <RepertoireAvocats roles={session.roles} />;
}
