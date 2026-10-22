import { getTranslations } from "next-intl/server";

import { ListeDossiers } from "@/components/modules/dossiers/liste-dossiers";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("dossiers");
  return { title: t("titre") };
}

/**
 * Screen 05 - case search.
 *
 * Server-side guard: `GET /dossiers` requires `ROLE_CONSULTATION`, which the lawyer does not hold.
 */
export default async function PageDossiers() {
  const session = await exigerCapacite("consulterDossiers");
  return <ListeDossiers roles={session.roles} />;
}
