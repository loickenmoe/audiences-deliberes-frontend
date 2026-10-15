import { getTranslations } from "next-intl/server";

import { ActiviteDesAvocats } from "@/components/modules/reporting/activite-des-avocats";
import { ActiviteParPersonne } from "@/components/modules/reporting/activite-par-personne";
import { FormulaireRapport } from "@/components/modules/reporting/formulaire-rapport";
import { peut } from "@/lib/rbac";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("rapports");
  return { title: t("titre") };
}

/**
 * Écran 40 — rapport d'activité. `GET /rapports` est `hasRole('JURISTE')` (#49) : le juriste y
 * accède directement, le DJ et la DJA par leur composite `ROLE_JURISTE` (backend Q-81). C'est ce
 * qui rend le parcours de pilotage P9 jouable d'un bout à l'autre et ferme QF-04.
 *
 * <p>**L'activité par personne (observation 14) y est jointe, mais pas pour tout le monde.** Elle
 * nomme des collègues : seuls le DJ et la DJA la voient, et le serveur le tient sur leurs rôles
 * propres - l'ouvrir par `ROLE_JURISTE`, composite, la donnerait à chaque juriste.
 */
export default async function PageRapports() {
  const session = await exigerCapacite("genererRapport");
  return (
    <div className="flex flex-col gap-6">
      <FormulaireRapport />
      {peut(session.roles, "consulterRapportNominatif") ? <ActiviteParPersonne /> : null}
      {/*
        Les avocats ont leur propre tableau (Q-136) : le précédent compte six natures de
        production interne qu'un avocat n'accomplit jamais - il dépose, c'est le juriste qui
        enregistre. Les réunir n'aurait affiché que des lignes de zéros.
      */}
      {peut(session.roles, "consulterRapportNominatif") ? <ActiviteDesAvocats /> : null}
    </div>
  );
}
