import { getTranslations } from "next-intl/server";

import { ListeIntervenants } from "@/components/modules/intervenants/liste-intervenants";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("intervenants");
  return { title: t("titre") };
}

/**
 * Screen 42 - external contributors reference data.
 *
 * Readable by every internal profile (#62, `ROLE_CONSULTATION`); creation is reserved to the DJ and
 * DJA (#61) and hidden from everyone else.
 */
export default async function PageIntervenants() {
  const session = await exigerCapacite("consulterReferentiels");
  return <ListeIntervenants roles={session.roles} />;
}
