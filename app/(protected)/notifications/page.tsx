import { getTranslations } from "next-intl/server";

import { FileNotifications } from "@/components/modules/notifications/file-notifications";
import { exigerSession } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("titre") };
}

/**
 * Screen 03 - my notifications. Open to every authenticated account, lawyer included: the backend
 * ensures each user only sees the alerts addressed to them.
 */
export default async function PageNotifications() {
  const session = await exigerSession();
  return <FileNotifications roles={session.roles} />;
}
