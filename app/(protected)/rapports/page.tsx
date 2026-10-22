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
 * Screen 40 - activity report. `GET /rapports` is `hasRole('JURISTE')` (#49): legal officers access it
 * directly, the DJ and DJA through their composite `ROLE_JURISTE`.
 *
 * Per-person activity names colleagues, so only the DJ and DJA see it, and the server checks their
 * own roles: opening it through the composite `ROLE_JURISTE` would expose it to every legal officer.
 */
export default async function PageRapports() {
  const session = await exigerCapacite("genererRapport");
  return (
    <div className="flex flex-col gap-6">
      <FormulaireRapport />
      {peut(session.roles, "consulterRapportNominatif") ? <ActiviteParPersonne /> : null}
      {/*
        Lawyers have their own table: the previous one counts six kinds of internal output a
        lawyer never produces (they submit, legal officers record). Merging them would only
        show rows of zeros.
      */}
      {peut(session.roles, "consulterRapportNominatif") ? <ActiviteDesAvocats /> : null}
    </div>
  );
}
