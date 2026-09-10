"use client";

import { useLocale, useTranslations } from "next-intl";

import { DateHeureValeur } from "@/components/metier";
import { useLibelles } from "@/hooks/useLibelles";
import type { HistoriqueAction } from "@/types/domaine";

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
 */
export function OngletHistorique({ historique }: { historique: readonly HistoriqueAction[] }) {
  const t = useTranslations("fiche");
  const locale = useLocale();
  const { nomUtilisateur } = useLibelles();

  if (historique.length === 0) {
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
    </div>
  );
}
