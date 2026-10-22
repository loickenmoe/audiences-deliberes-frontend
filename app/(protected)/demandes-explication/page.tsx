import { getTranslations } from "next-intl/server";

import { EcranExplications } from "@/components/modules/explications/ecran-explications";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("explications");
  return { title: t("titre") };
}

/**
 * Screen 47 - requests for explanation.
 *
 * Open to management **and to the lawyer**: the same exchange, read from both ends. The server
 * decides which rows each user sees; the screen sends no scope.
 */
export default async function PageDemandesExplication() {
  const session = await exigerCapacite("consulterExplications");
  return <EcranExplications roles={session.roles} />;
}
