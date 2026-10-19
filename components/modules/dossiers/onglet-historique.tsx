"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { DateHeureValeur, Pagination } from "@/components/metier";
import { useHistoriqueDossier } from "@/hooks/useDossiers";
import { useLibelles } from "@/hooks/useLibelles";
import { useLibellesHistorique } from "@/hooks/useLibellesHistorique";
import { messageErreur } from "@/lib/api/errors";

/** Renders a `details` value, whose shape varies from one action to another. */
function valeurLisible(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

/**
 * Screen 15 - case history, newest first (backend order).
 * `action` is stored as a French sentence (the record made at the time is never retranslated), but
 * each row also carries a typed code whose label is translated on display, like the `details` keys.
 * Paginated: RG-DOS-06 logs every action, so a long-running case can reach hundreds of entries. The
 * case page response only carries the ten most recent; this tab reads the dedicated endpoint.
 */
export function OngletHistorique({ dossierId }: { dossierId: number }) {
  const t = useTranslations("fiche");
  const { nomUtilisateur } = useLibelles();
  const { libelleAction, libelleDetail } = useLibellesHistorique();
  const [page, setPage] = useState(0);
  const requete = useHistoriqueDossier(dossierId, page);

  const historique = requete.data?.content ?? [];

  if (requete.isLoading) return <EtatChargement lignes={5} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;

  if (historique.length === 0 && page === 0) {
    return <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("historiqueVide")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col divide-y divide-bordure rounded border border-bordure bg-surface">
        {historique.map((entree) => (
          <li key={entree.id} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[length:var(--taille-sm)] font-medium">
                {libelleAction(entree.code, entree.action)}
              </span>
              <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                <DateHeureValeur valeur={entree.dateAction} />
                {" · "}
                {entree.utilisateurId !== null ? nomUtilisateur(entree.utilisateurId) : t("historiqueSysteme")}
              </span>
            </div>

            {entree.details && Object.keys(entree.details).length > 0 ? (
              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[length:var(--taille-xs)] text-texte-secondaire">
                {Object.entries(entree.details).map(([cle, valeur]) => (
                  <div key={cle} className="flex gap-1.5">
                    <dt className="text-texte-tertiaire">{libelleDetail(cle)}</dt>
                    <dd>{valeurLisible(valeur)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ol>

      {requete.data ? (
        <Pagination
          page={page}
          totalPages={requete.data.totalPages}
          totalElements={requete.data.totalElements}
          onChangement={setPage}
        />
      ) : null}
    </div>
  );
}
