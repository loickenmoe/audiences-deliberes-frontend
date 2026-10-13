import { getTranslations } from "next-intl/server";

import { RepertoireAvocats } from "@/components/modules/repertoire/repertoire-avocats";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("repertoire");
  return { title: t("titre") };
}

/**
 * Écran 34 — répertoire des avocats (juristes, Assistante).
 *
 * <p>Les rôles descendent dans l'écran depuis Q-135 : le DJ et la DJA y ouvrent la **fiche
 * d'activité** d'un avocat, et eux seuls. Le serveur l'arbitre - masquer n'est pas sécuriser - mais
 * l'écran ne doit pas proposer une porte qui donne sur un mur.
 */
export default async function PageRepertoire() {
  const session = await exigerCapacite("consulterRepertoire");
  return <RepertoireAvocats roles={session.roles} />;
}
