import { getTranslations } from "next-intl/server";

import { ListeClients } from "@/components/modules/clients/liste-clients";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("clients");
  return { title: t("titre") };
}

/**
 * Écran 19 — recherche de clients.
 *
 * La garde est ici, côté serveur : un profil sans `ROLE_CONSULTATION` — l'avocat — est renvoyé vers
 * l'écran de refus avant tout rendu.
 */
export default async function PageClients() {
  const session = await exigerCapacite("consulterReferentiels");
  return <ListeClients roles={session.roles} />;
}
