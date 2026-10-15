import { getTranslations } from "next-intl/server";

import { EcranExplications } from "@/components/modules/explications/ecran-explications";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("explications");
  return { title: t("titre") };
}

/**
 * Écran 47 — les demandes d'explication (N7 temps 2).
 *
 * Ouvert à la direction **et à l'avocat** : c'est le même échange, lu des deux bouts. Le serveur
 * décide des lignes que chacun voit ; l'écran n'envoie aucun périmètre.
 */
export default async function PageDemandesExplication() {
  const session = await exigerCapacite("consulterExplications");
  return <EcranExplications roles={session.roles} />;
}
