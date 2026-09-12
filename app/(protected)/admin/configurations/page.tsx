import { getTranslations } from "next-intl/server";

import { ParametresSysteme } from "@/components/modules/administration/parametres-systeme";
import { peut } from "@/lib/rbac";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("configurations");
  return { title: t("titre") };
}

/**
 * Écran 41 — paramètres système. La lecture est ouverte à tous les profils internes (#47,
 * `ROLE_CONSULTATION`) : ces seuils expliquent le comportement de l'application, les cacher
 * n'aiderait personne. La modification reste au DJ seul (#48).
 */
export default async function PageConfigurations() {
  const session = await exigerCapacite("consulterConfigurations");
  return <ParametresSysteme modifiable={peut(session.roles, "administrerConfigurations")} />;
}
