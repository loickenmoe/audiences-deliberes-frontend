"use client";

import { useLocale, useTranslations } from "next-intl";

import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { DateHeureValeur, Pagination } from "@/components/metier";
import { useHistoriqueDossier } from "@/hooks/useDossiers";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";

/** Rend une valeur de `details`, dont la forme varie d'une action à l'autre. */
function valeurLisible(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

/**
 * Écran 15 — historique du dossier, du plus récent au plus ancien (ordre du backend).
 *
 * ⚠ `action` est une phrase **française** rédigée par le backend, pas un code (QF-24) : elle ne
 * peut pas être traduite ici. En anglais, on l'affiche telle quelle et on le dit, plutôt que de
 * laisser croire à un oubli de traduction.
 *
 * **Paginé depuis Q-100.** RG-DOS-06 historise chaque action : sur un dossier suivi plusieurs
 * années, l'historique atteint des centaines d'entrées, qui voyageaient toutes dans la réponse de la
 * fiche. Celle-ci n'en porte plus que les dix plus récentes ; cet onglet lit l'endpoint dédié, si
 * bien que **rien n'est perdu** — la suite est sur les pages suivantes.
 */
export function OngletHistorique({ dossierId }: { dossierId: number }) {
  const t = useTranslations("fiche");
  const locale = useLocale();
  const { nomUtilisateur } = useLibelles();
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
      {locale !== "fr" ? (
        <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("historiqueLangue")}</p>
      ) : null}

      <ol className="flex flex-col divide-y divide-bordure rounded border border-bordure bg-surface">
        {historique.map((entree) => (
          <li key={entree.id} className="flex flex-col gap-1.5 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[length:var(--taille-sm)] font-medium" lang="fr">
                {entree.action}
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
                    <dt className="font-mono text-texte-tertiaire">{cle}</dt>
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
