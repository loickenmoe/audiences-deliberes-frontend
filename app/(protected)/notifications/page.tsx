import { getTranslations } from "next-intl/server";

import { FileNotifications } from "@/components/modules/notifications/file-notifications";
import { exigerSession } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("titre") };
}

/**
 * Écran 03 — mes notifications. Ouvert à tout compte authentifié, avocat compris : chacun n'y voit
 * que les alertes dont il est le destinataire, le backend s'en assure.
 */
export default async function PageNotifications() {
  const session = await exigerSession();
  return <FileNotifications roles={session.roles} />;
}
