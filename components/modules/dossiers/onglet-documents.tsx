"use client";

import { useTranslations } from "next-intl";

import { EtatChargement, EtatErreur } from "@/components/global";
import { DateHeureValeur, PoidsFichier } from "@/components/metier";
import { useDocumentsDossier } from "@/hooks/useDossiers";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";

/**
 * Onglet documents — lecture seule.
 *
 * La source est `GET /dossiers/{id}/documents` (#43) et **jamais** `DossierResponse.documents`, vide
 * par construction (Q-67 backend). Le dépôt et la suppression arrivent avec le module GED.
 */
export function OngletDocuments({ dossierId }: { dossierId: number }) {
  const t = useTranslations("fiche");
  const requete = useDocumentsDossier(dossierId);
  const { nomUtilisateur } = useLibelles();

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) {
    return <EtatErreur message={messageErreur(requete.error)} />;
  }

  // Les documents supprimés restent dans la réponse, marqués : ils ne doivent pas s'afficher ici.
  const documents = (requete.data ?? []).filter((document) => !document.estSupprime);

  if (documents.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded border border-dashed border-bordure-forte px-6 py-10 text-center">
        <p className="font-medium">{t("documentsVide")}</p>
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("documentsVideTexte")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-bordure bg-surface">
      <table className="w-full text-left text-[length:var(--taille-sm)]">
        <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">{t("colonneFichier")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t("colonneFormat")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t("colonnePoids")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t("colonneDepot")}</th>
            <th scope="col" className="px-4 py-2 font-medium">{t("colonneAuteur")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bordure">
          {documents.map((document) => (
            <tr key={document.id}>
              <td className="px-4 py-2">{document.nomFichier}</td>
              <td className="px-4 py-2 font-mono text-[length:var(--taille-xs)]">{document.format}</td>
              <td className="px-4 py-2">
                <PoidsFichier valeur={document.poids} />
              </td>
              <td className="px-4 py-2">
                <DateHeureValeur valeur={document.dateChargement} />
              </td>
              <td className="px-4 py-2">
                {document.auteurChargementId !== null ? nomUtilisateur(document.auteurChargementId) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
