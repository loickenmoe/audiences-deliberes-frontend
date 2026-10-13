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

/**
 * L'onglet de la fiche dossier où chaque indicateur se regarde.
 *
 * Absent de cette carte, l'indicateur ouvre la **synthèse** du dossier - mieux vaut arriver sur le
 * bon dossier que ne pas pouvoir cliquer. Les onglets nommés ici sont ceux que `fiche-dossier.tsx`
 * déclare, et un test unitaire le vérifie : promettre un onglet qui n'existe pas retomberait
 * silencieusement sur la synthèse, et la promesse serait fausse sans que rien ne le dise.
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
 * Où mène une ligne du détail.
 *
 * **Les frais font exception** : la ligne est une demande de frais, qui a son propre écran. Y mener
 * vaut mieux que d'ouvrir le dossier, où il faudrait la retrouver - et la fiche dossier n'a pas
 * d'onglet Frais.
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
 * Le détail d'un bloc du tableau de bord (Q-137).
 *
 * **Ce que le métier a demandé** le 2026-10-13 : qu'un clic sur un bloc ouvre la liste de ce qu'il
 * compte, et que chaque ligne mène à sa fiche. Même geste que sur la fiche d'activité, mécanique
 * différente : là tout venait de l'historique des actions, ici chaque indicateur a sa source.
 *
 * **Le total affiché est celui du serveur, jamais une somme des lignes montrées.** La liste est
 * paginée : additionner ce qu'on voit donnerait un chiffre plus petit dès la deuxième page, et ce
 * chiffre contredirait le bloc d'où l'on vient.
 *
 * **Deux précisions s'affichent quand elles s'appliquent**, parce qu'elles expliquent un écart que
 * la Direction remarquerait autrement : les trois indicateurs de litiges ne portent que sur le
 * recouvrement, et les prorogations comptent une ligne par alerte envoyée.
 */
export function DetailIndicateurModale({
  indicateur,
  libelle,
  onFermeture,
}: {
  /** `null` ferme la modale. Le composant reste monté : son état de page se réinitialise à l'ouverture. */
  indicateur: IndicateurTableauDeBord | null;
  libelle: string;
  onFermeture: () => void;
}) {
  const t = useTranslations("detailIndicateur");
  const [page, setPage] = useState(0);

  const detail = useQuery({
    queryKey: ["detail-indicateur", indicateur, page],
    queryFn: () => reportingService.detailTableauDeBord(indicateur!, page),
    enabled: indicateur !== null,
  });

  const lignes = detail.data?.content ?? [];
  const pages = detail.data?.totalPages ?? 0;
  const avecMontant = lignes.some((ligne) => ligne.montant !== null);
  const avecDate = lignes.some((ligne) => ligne.date !== null);

  const restriction =
    indicateur === "LITIGES_GAGNES" ||
    indicateur === "LITIGES_PERDUS" ||
    indicateur === "DECISIONS_MIXTES"
      ? t("restrictionRecouvrement")
      : indicateur === "PROROGATIONS_ALERTE"
        ? t("uneLigneParAlerte")
        : undefined;

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
                          Trois états, et chacun dit autre chose : une ligne hors dossier n'a rien à
                          ouvrir, un dossier supprimé depuis a existé, et le cas courant mène à la
                          fiche - sur l'onglet qui correspond à l'indicateur.
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
