"use client";

import { useTranslations } from "next-intl";

import { Champ, Select } from "@/components/ui/champ";
import { CompteAvocatNonRattache } from "@/components/modules/portail/compte-non-rattache";
import { useMesDossiers } from "@/hooks/usePortailAvocat";
import { estCompteAvocatNonRattache } from "@/lib/api/errors";

/**
 * Choix d'un dossier parmi ceux auxquels l'avocat est affecté.
 *
 * C'est la pièce qui débloque tout le portail : jusqu'à Q-96, l'avocat devait fournir un
 * `dossierId` qu'aucun endpoint ne lui permettait de connaître (QF-01), alors que les stories 4.1
 * et 5.1 supposent qu'il le **choisisse**.
 *
 * Un avocat sans dossier voit une explication plutôt qu'un sélecteur vide : il n'a rien à corriger,
 * c'est une affectation qui manque.
 */
export function SelecteurDossier({
  valeur,
  onChangement,
  id = "dossier",
}: {
  valeur: number | null;
  onChangement: (dossierId: number | null) => void;
  id?: string;
}) {
  const t = useTranslations("portail");
  const requete = useMesDossiers();
  const dossiers = requete.data?.content ?? [];

  // Q-107 : distinguer « pas encore inscrit au répertoire » de « aucun dossier affecté ». Les deux
  // sont des états légitimes, mais ils n'appellent pas la même action de l'avocat.
  if (estCompteAvocatNonRattache(requete.error)) return <CompteAvocatNonRattache />;

  if (!requete.isLoading && dossiers.length === 0) {
    return (
      <p className="max-w-prose rounded border border-dashed border-bordure-forte bg-surface px-4 py-3 text-[length:var(--taille-sm)] text-texte-secondaire">
        {t("aucunDossier")}
      </p>
    );
  }

  return (
    <Champ id={id} label={t("dossier")} aide={t("dossierAide")} obligatoire className="max-w-md">
      <Select
        id={id}
        required
        disabled={requete.isLoading}
        value={valeur ?? ""}
        onChange={(evenement) =>
          onChangement(evenement.target.value === "" ? null : Number(evenement.target.value))
        }
      >
        <option value="">{t("choisirDossier")}</option>
        {dossiers.map((dossier) => (
          <option key={dossier.id} value={dossier.id}>
            {dossier.reference} - {dossier.nature} ({dossier.juridictionSaisie})
          </option>
        ))}
      </Select>
    </Champ>
  );
}
