import { getTranslations } from "next-intl/server";

import { MaSignature } from "@/components/modules/compte/ma-signature";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("compte");
  return { title: t("titre") };
}

/**
 * Mon compte — ma signature enregistrée (N8) et mon activité (Q-133).
 *
 * <p>**Pourquoi l'activité vit ici et non sur l'écran des rapports.** « Chaque utilisateur doit être
 * capable de télécharger ses propres rapports » (métier, 2026-10-09) - or `/rapports` exige
 * `ROLE_JURISTE` : l'Assistante et le supérieur hiérarchique n'y entrent pas. Les y laisser entrer
 * leur montrerait le rapport périodique du service, auquel ils n'ont pas droit, et dont l'appel
 * échouerait sous leurs yeux. « Mon compte » est le seul écran que les cinq profils internes
 * partagent, et c'est l'endroit où l'on vient chercher ce qui est à soi.
 *
 * Ouvert à tous les profils **internes** : chacun peut déposer la sienne, et c'est la condition
 * pour qu'elle garde un sens (métier, 2026-10-06). L'avocat, qui ne porte pas `ROLE_CONSULTATION`,
 * n'y accède pas : il ne signe aucune lettre de la banque.
 */
export default async function PageMonCompte() {
  const t = await getTranslations("compte");
  await exigerCapacite("consulterReferentiels");
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>
      <MaSignature />
      <FicheActivite />
    </div>
  );
}
