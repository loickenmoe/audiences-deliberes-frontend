import { getTranslations } from "next-intl/server";

import { MaSignature } from "@/components/modules/compte/ma-signature";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("compte");
  return { title: t("titre") };
}

/**
 * My account - my saved signature and my activity.
 *
 * Personal activity lives here rather than on the reports screen because `/rapports` requires
 * `ROLE_JURISTE`, which the assistant and line manager lack, and would expose the department report.
 * "My account" is the only screen shared by all five internal profiles.
 *
 * Open to all **internal** profiles. The lawyer, without `ROLE_CONSULTATION`, has no access: they
 * sign no bank letters.
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
