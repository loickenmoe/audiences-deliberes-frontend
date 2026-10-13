import { getTranslations } from "next-intl/server";

import { EspaceAvocat } from "@/components/modules/portail/espace-avocat";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("portail");
  return { title: t("espaceTitre") };
}

/**
 * Espace de l'avocat : ses dépôts, ses lettres de constitution (backend Q-96) et **son activité**
 * (Q-135). Réservé à `ROLE_AVOCAT` — les profils internes ont leurs propres files.
 *
 * <p>**Pourquoi son activité est ici et non sur « Mon compte ».** Cet écran-là porte aussi « Ma
 * signature », qui n'a pas de sens pour lui : il ne signe aucune lettre de la banque. Et il ne
 * porte pas `ROLE_CONSULTATION`, donc il n'y entre pas (QF-01). « Mon espace » est son écran.
 *
 * <p>**Ses lignes de détail ne mènent à aucun dossier**, et c'est voulu : l'avocat n'a pas d'écran
 * de fiche dossier. Il lit la référence, qui lui suffit - c'est ainsi qu'il nomme ses affaires dans
 * ses échanges avec la banque - et un lien ne l'aurait mené qu'à un refus de droits.
 */
export default async function PagePortail() {
  await exigerCapacite("deposerPublication");
  return (
    <div className="flex flex-col gap-6">
      <EspaceAvocat />
      <FicheActivite lienVersDossier={false} />
    </div>
  );
}
