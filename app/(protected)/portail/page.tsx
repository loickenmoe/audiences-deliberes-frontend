import { getTranslations } from "next-intl/server";

import { EspaceAvocat } from "@/components/modules/portail/espace-avocat";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("espaceTitre") };
}

/**
 * Espace de l'avocat : ses dépôts et ses lettres de constitution (backend Q-96). Réservé à
 * `ROLE_AVOCAT` — les profils internes ont leurs propres files.
 */
export default async function PagePortail() {
  await exigerCapacite("deposerPublication");
  return <EspaceAvocat />;
}
