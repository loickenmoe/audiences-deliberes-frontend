"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { MontantFcfa } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { messageErreur } from "@/lib/api/errors";
import { reportingService } from "@/services/reportingService";
import type { DetailIndicateur, IndicateurTableauDeBord } from "@/types/domaine";
import type { CategorieDossier } from "@/types/enums";

/**
 * The case file tab where each indicator is viewed.
 *
 * An indicator absent from this map opens the case file summary. The tabs named here are those
 * declared in `fiche-dossier.tsx`, checked by a unit test: an unknown tab would silently fall back
 * to the summary.
 */
const ONGLET_PAR_INDICATEUR: Partial<Record<IndicateurTableauDeBord, string>> = {
  AUDIENCES_PLANIFIEES: "audiences",
  PROROGATIONS_ALERTE: "deliberes",
  LITIGES_GAGNES: "deliberes",
  LITIGES_PERDUS: "deliberes",
  DECISIONS_MIXTES: "deliberes",
  PROVISIONS_REPRISES: "decisions",
};

/**
 * Where a detail row leads. Expenses are the exception: the row is an expense request, which has its
 * own screen (the case file has no Expenses tab).
 */
function lienDeLaLigne(
  indicateur: IndicateurTableauDeBord,
  ligne: DetailIndicateur,
): string | null {
  if (indicateur === "FRAIS_EN_ATTENTE") return `/frais/${ligne.id}`;
  if (ligne.dossierId === null) return null;
  const onglet = ONGLET_PAR_INDICATEUR[indicateur];
  return onglet ? `/dossiers/${ligne.dossierId}?onglet=${onglet}` : `/dossiers/${ligne.dossierId}`;
}

/**
 * Detail of a dashboard block: the list of what it counts, each row leading to its record.
 *
 * The total shown is the server's, never a sum of the displayed rows: the list is paginated, and a
 * sum of visible rows would contradict the block's figure.
 * Explanatory notes are shown when they apply, to explain otherwise surprising differences.
 */
export function DetailIndicateurModale({
  indicateur,
  libelle,
  categorie,
  onFermeture,
}: {
  /** `null` closes the modal. The component stays mounted: its page state is reset on opening. */
  indicateur: IndicateurTableauDeBord | null;
  libelle: string;
  /** The scope of the originating block. Absent = both categories. */
  categorie?: CategorieDossier;
  onFermeture: () => void;
}) {
  const t = useTranslations("detailIndicateur");
  const [page, setPage] = useState(0);

  const detail = useQuery({
    // The scope is part of the key: without it, reopening a block after changing category would show
    // the previous category's list.
    queryKey: ["detail-indicateur", indicateur, categorie ?? "TOUTES", page],
    queryFn: () => reportingService.detailTableauDeBord(indicateur!, page, categorie),
    enabled: indicateur !== null,
  });

  const lignes = detail.data?.content ?? [];
  const pages = detail.data?.totalPages ?? 0;
  const avecMontant = lignes.some((ligne) => ligne.montant !== null);
  const avecDate = lignes.some((ligne) => ligne.date !== null);

  /*
   * The three litigation indicators follow the scope selected at the top of the screen, so they need
   * no note. The alerts note remains: it explains what a row represents (one row per alert sent).
   */
  const restriction = indicateur === "PROROGATIONS_ALERTE" ? t("uneLigneParAlerte") : undefined;

  return (
    <Dialog
      ouvert={indicateur !== null}
      onFermeture={onFermeture}
      titre={t("titre", { libelle })}
      description={
        detail.data === undefined
          ? restriction
          : [t("sousTitre", { total: detail.data.totalElements }), restriction]
              .filter(Boolean)
              .join(" ")
      }
      className="max-w-3xl"
    >
      {detail.isLoading ? (
        <EtatChargement lignes={4} />
      ) : detail.error ? (
        <EtatErreur message={messageErreur(detail.error)} />
      ) : lignes.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("vide")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[length:var(--taille-sm)]">
              <thead className="border-b border-bordure text-[length:var(--taille-xs)] text-texte-secondaire">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colonneIntitule")}</th>
                  <th scope="col" className="py-2 pr-4 font-medium">{t("colonnePrecision")}</th>
                  {avecDate ? (
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colonneDate")}</th>
                  ) : null}
                  {avecMontant ? (
                    <th scope="col" className="py-2 pr-4 font-medium">{t("colonneMontant")}</th>
                  ) : null}
                  <th scope="col" className="py-2 font-medium">{t("colonneDossier")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {lignes.map((ligne) => {
                  const lien = indicateur === null ? null : lienDeLaLigne(indicateur, ligne);
                  return (
                    <tr key={ligne.id}>
                      <td className="py-2 pr-4 font-medium">{ligne.intitule ?? "—"}</td>
                      <td className="py-2 pr-4">{ligne.precision ?? "—"}</td>
                      {avecDate ? (
                        <td className="py-2 pr-4 whitespace-nowrap">{ligne.date ?? "—"}</td>
                      ) : null}
                      {avecMontant ? (
                        <td className="py-2 pr-4" data-nombres>
                          {ligne.montant === null ? "—" : <MontantFcfa valeur={ligne.montant} />}
                        </td>
                      ) : null}
                      <td className="py-2">
                        {/*
                          Three states: a row without a case file has nothing to open, a since-deleted case file did
                          exist, and the usual case leads to the case file on the tab matching the indicator.
                        */}
                        {lien === null ? (
                          <span className="text-texte-tertiaire">{t("sansDossier")}</span>
                        ) : ligne.referenceDossier === null && indicateur !== "FRAIS_EN_ATTENTE" ? (
                          <span className="text-texte-tertiaire">{t("dossierSupprime")}</span>
                        ) : (
                          <Link
                            href={lien}
                            className="text-lien underline hover:no-underline"
                            aria-label={
                              indicateur === "FRAIS_EN_ATTENTE"
                                ? t("ouvrirFrais")
                                : t("ouvrirDossier", { reference: ligne.referenceDossier ?? "" })
                            }
                          >
                            {ligne.referenceDossier ?? t("ouvrirFrais")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <Button
                variante="secondaire"
                onClick={() => setPage((courante) => Math.max(0, courante - 1))}
                disabled={page === 0}
              >
                {t("pagePrecedente")}
              </Button>
              <span className="text-[length:var(--taille-xs)] text-texte-secondaire">
                {t("positionPage", { page: page + 1, total: pages })}
              </span>
              <Button
                variante="secondaire"
                onClick={() => setPage((courante) => courante + 1)}
                disabled={page + 1 >= pages}
              >
                {t("pageSuivante")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
