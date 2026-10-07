import { getTranslations } from "next-intl/server";

import { MaSignature } from "@/components/modules/compte/ma-signature";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("compte");
  return { title: t("titre") };
}

/**
 * Mon compte — pour l'instant, ma signature enregistrée (N8).
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
    </div>
  );
}
