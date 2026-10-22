import { getTranslations } from "next-intl/server";

import { ListeClients } from "@/components/modules/clients/liste-clients";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("clients");
  return { title: t("titre") };
}

/**
 * Screen 19 - client search.
 *
 * Server-side guard: a profile without `ROLE_CONSULTATION` (the lawyer) is redirected to the
 * access-denied screen before any rendering.
 */
export default async function PageClients() {
  const session = await exigerCapacite("consulterReferentiels");
  return <ListeClients roles={session.roles} />;
}
