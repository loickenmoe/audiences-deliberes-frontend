"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { messageErreur } from "@/lib/api/errors";
import { telechargerBlob } from "@/lib/documents";
import { periodeDe } from "@/lib/periodes";
import { EXTENSION_RAPPORT, nomFichierActivite } from "@/lib/rapports";
import { reportingService, type CibleActivite } from "@/services/reportingService";
import type { ActionDetaillee, RapportActivite } from "@/types/domaine";

/**
 * The case file tab where each action type is viewed.
 *
 * The tabs are exactly those of `fiche-dossier.tsx` (there is no expenses tab: expense requests have
 * their own screen); the assertion below enforces it, since an unknown tab silently falls back to the
 * summary. A type absent from this map opens the case file summary on purpose: expenses (the action
 * only carries the case file) and actions on the case file itself (assignment, sensitivity, threshold
 * waiver).
 */
const ONGLET_PAR_NATURE: Record<string, string> = {
  ETAPE_STATUT_MODIFIE: "etapes",
  ETAPE_POSITIONNEE_DIRECTEMENT: "etapes",
  AUDIENCE_PLANIFIEE: "audiences",
  AUDIENCE_COMPTE_RENDU_ENREGISTRE: "audiences",
  AUDIENCE_ANNULEE: "audiences",
  AUDIENCE_DOUBLON_CONFIRME: "audiences",
  ALARME_CREEE: "alarmes",
  ALARME_REPROGRAMMEE: "alarmes",
  ALARME_TRAITEE: "alarmes",
  DELIBERE_MISE_EN_DELIBERE: "deliberes",
  DELIBERE_ENREGISTRE: "deliberes",
  DELIBERE_VIDE: "deliberes",
  DELIBERE_PROROGE: "deliberes",
  DELIBERE_RABATTU: "deliberes",
  DELIBERE_EXPEDITION_MODIFIEE: "deliberes",
  ADJUDICATION_ENREGISTREE: "decisions",
  CONDAMNATION_ENREGISTREE: "decisions",
  CONDAMNATION_STATUT_MODIFIE: "decisions",
  DOCUMENT_CHARGE: "documents",
  DOCUMENT_SUPPRESSION_DEMANDEE: "documents",
  DOCUMENT_SUPPRIME_DIRECTEMENT: "documents",
  DOCUMENT_SUPPRESSION_ARBITREE: "documents",
  CONSTITUTION_DEMANDEE: "publications",
  CONSTITUTION_ARBITREE: "publications",
  LETTRE_CONSTITUTION_REDIGEE: "publications",
  PUBLICATION_CR_DEPOSE: "publications",
  PUBLICATION_AUTRE_DEPOSEE: "publications",
  PUBLICATION_ARBITREE: "publications",
  PUBLICATION_COMMENTEE: "publications",
  PUBLICATION_CORRESPONDANCE_TRANSMISE: "publications",
};

/**
 * Where a click on an action leads. An unmapped action type opens the case file summary on
 * purpose: the map covers types with a dedicated tab, and action codes evolve.
 */
function lienVers(action: ActionDetaillee, autorise: boolean): string | null {
  if (!autorise || action.dossierId === null) return null;
  const onglet = ONGLET_PAR_NATURE[action.code];
  return onglet ? `/dossiers/${action.dossierId}?onglet=${onglet}` : `/dossiers/${action.dossierId}`;
}

/**
 * A person's activity sheet.
 *
 * Users can download their own reports for the chosen period (three formats), and clicking a count
 * opens the counted actions, then the related case file.
 * Exhaustive rather than comparable: the management table has six columns for comparison; this sheet
 * shows every action type performed, since some profiles (Assistant, line manager) never open case files.
 * No score and no total, like the named table. Also available to lawyers, whose submissions, hearing
 * reports, publications and explanation answers are tracked under their account.
 *
 * @param cible            whom we look at: a `utilisateurId` for a colleague, an `avocatId` for a
 *                         lawyer from the directory. Absent means oneself; the server refuses
 *                         another person's activity to anyone but the DJ and DJA.
 * @param nomAffiche       the name to display as title, when the caller already knows it.
 * @param lienVersDossier  `false` removes detail links and keeps the case file reference as text,
 *                         for lawyers, who have no case file screen and would get an access denied.
 */
export function FicheActivite({
  cible,
  nomAffiche,
  lienVersDossier = true,
}: {
  cible?: CibleActivite;
  nomAffiche?: string;
  lienVersDossier?: boolean;
}) {
  const t = useTranslations("activite");
  const tNatures = useTranslations("historique.actions");
  const defaut = periodeDe("mois");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const [format, setFormat] = useState<keyof typeof EXTENSION_RAPPORT>("PDF");
  const [rapport, setRapport] = useState<RapportActivite | null>(null);
  const [affiche, setAffiche] = useState(false);
  // The action type whose detail is open. `null` when the modal is closed: keeping the last one
  // would show stale content on the next click.
  const [natureOuverte, setNatureOuverte] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const autre = cible !== undefined;
  /*
    Field ids must be unique on the screen: the management table can show one's own sheet and a
    colleague's at the same time. "moi" when there is no target.
  */
  const suffixe = cible === undefined
    ? "moi"
    : "utilisateurId" in cible
      ? `u${cible.utilisateurId}`
      : `a${cible.avocatId}`;
  const valide = debut <= fin;

  const generer = useMutation({
    mutationFn: () => reportingService.rapportActivite(debut, fin, cible),
    onSuccess: (resultat) => {
      setRapport(resultat);
      setAffiche(true);
    },
  });

  const telecharger = useMutation({
    mutationFn: async () => {
      const contenu = await reportingService.exporterActivite(debut, fin, format, cible);
      if (contenu === null) return;
      // The file name is built here: `Content-Disposition` is not exposed through CORS, and the server
      // applies the same rule (`nomFichierActivite`).
      telechargerBlob(
        contenu,
        nomFichierActivite(
          { nom: rapport?.nom ?? nomAffiche ?? null, utilisateurId: rapport?.utilisateurId ?? 0 },
          debut,
          fin,
          format,
        ),
      );
    },
  });

  const detail = useQuery({
    queryKey: ["activite-details", suffixe, natureOuverte, debut, fin, page],
    queryFn: () => reportingService.detailsActivite(natureOuverte!, debut, fin, page, cible),
    enabled: natureOuverte !== null,
  });

  function ouvrirDetail(code: string) {
    setPage(0);
    setNatureOuverte(code);
  }

  return (
    <section className="flex flex-col gap-4 border-t border-bordure pt-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--taille-lg)] font-semibold">
          {autre ? t("titreAutre", { personne: nomAffiche ?? t("personneSansNom") }) : t("titre")}
        </h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {autre ? t("descriptionAutre") : t("description")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded border border-bordure bg-surface p-3">
        <Champ id={`activite-debut-${suffixe}`} label={t("dateDebut")} className="w-44">
          <Input
            id={`activite-debut-${suffixe}`}
            type="date"
            value={debut}
            onChange={(evenement) => setDebut(evenement.target.value)}
          />
        </Champ>
        <Champ
          id={`activite-fin-${suffixe}`}
          label={t("dateFin")}
          erreur={valide ? undefined : t("periodeInversee")}
          className="w-44"
        >
          <Input
            id={`activite-fin-${suffixe}`}
            type="date"
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
          />
        </Champ>
        <Button onClick={() => generer.mutate()} disabled={!valide || generer.isPending}>
          {generer.isPending ? t("enCours") : t("afficher")}
        </Button>

        {/* Download appears only once the sheet is displayed, to avoid exporting an unseen, possibly empty period. */}
        {rapport !== null ? (
          <>
            <Champ
              id={`activite-format-${suffixe}`}
              label={t("formatExport")}
              className="w-32"
            >
              <Select
                id={`activite-format-${suffixe}`}
                value={format}
                onChange={(evenement) =>
                  setFormat(evenement.target.value as keyof typeof EXTENSION_RAPPORT)
                }
              >
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
                <option value="CSV">CSV</option>
              </Select>
            </Champ>
            <Button
              variante="secondaire"
              onClick={() => telecharger.mutate()}
              disabled={telecharger.isPending}
            >
              {t("telecharger")}
            </Button>
          </>
        ) : null}
      </div>

      {generer.error ? <EtatErreur message={messageErreur(generer.error)} /> : null}
      {telecharger.error ? <EtatErreur message={t("telechargementEchoue")} /> : null}

      {!affiche ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("avantGeneration")}</p>
      ) : rapport === null ? (
        <EtatVide titre={t("vide")} description={autre ? t("videTexteAutre") : t("videTexte")} />
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-bordure bg-surface">
            <table className="w-full text-left text-[length:var(--taille-sm)]">
              <caption className="sr-only">
                {t("legende", { debut: rapport.dateDebut, fin: rapport.dateFin })}
              </caption>
              <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneNature")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneNombre")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneDetail")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {rapport.lignes.map((ligne) => {
                  const nature = tNatures(ligne.code as never);
                  return (
                    <tr key={ligne.code}>
                      <td className="px-4 py-2 font-medium">{nature}</td>
                      <td className="px-4 py-2" data-nombres>{ligne.total}</td>
                      <td className="px-4 py-2">
                        {/*
                          The count itself is not the button: a screen reader would announce "4" without saying what it
                          opens. The button carries the action type and the count.
                        */}
                        <button
                          type="button"
                          className="text-lien underline hover:no-underline"
                          onClick={() => ouvrirDetail(ligne.code)}
                        >
                          {t("voirDetail", { nombre: ligne.total, nature })}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/*
            The average delay is outside the table: it is not an action count and must not look summable.
            Absent (not zero) when no hearing report was entered: zero would read as same-day entry.
          */}
          {typeof rapport.delaiMoyenSaisieCompteRendu === "number" ? (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire" title={t("delaiAide")}>
              {t("delai")} :{" "}
              <span data-nombres className="font-medium text-texte">
                {t("delaiJours", { jours: rapport.delaiMoyenSaisieCompteRendu.toFixed(1) })}
              </span>
            </p>
          ) : null}
        </>
      )}

      <Dialog
        ouvert={natureOuverte !== null}
        onFermeture={() => setNatureOuverte(null)}
        titre={natureOuverte === null ? "" : t("detailTitre", { nature: tNatures(natureOuverte as never) })}
        description={t("detailDescription", { debut, fin })}
      >
        {detail.isLoading ? (
          <EtatChargement lignes={3} />
        ) : detail.error ? (
          <EtatErreur message={messageErreur(detail.error)} />
        ) : (detail.data?.content.length ?? 0) === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("detailVide")}</p>
        ) : (
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">{t("detailColonneDate")}</th>
                <th scope="col" className="py-2 pr-4 font-medium">{t("detailColonneAction")}</th>
                <th scope="col" className="py-2 font-medium">{t("detailColonneDossier")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {detail.data?.content.map((action) => {
                const lien = lienVers(action, lienVersDossier);
                return (
                  <tr key={action.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{action.dateAction.slice(0, 10)}</td>
                    <td className="py-2 pr-4">{action.action}</td>
                    <td className="py-2">
                      {/*
                        Three states: an action without a case file (a configuration, a reference data change) has
                        nothing to open; a since-deleted case file did exist; the usual case leads to the case file.
                      */}
                      {action.dossierId === null ? (
                        <span className="text-texte-tertiaire">{t("detailHorsDossier")}</span>
                      ) : action.referenceDossier === null ? (
                        <span className="text-texte-tertiaire">{t("detailDossierSupprime")}</span>
                      ) : lien === null ? (
                        /*
                          The lawyer sees the reference without a link: they have no case file screen. The reference is
                          how they name their cases with the bank.
                        */
                        <span>{action.referenceDossier}</span>
                      ) : (
                        <Link
                          href={lien}
                          className="text-lien underline hover:no-underline"
                          aria-label={t("detailOuvrir", { reference: action.referenceDossier })}
                        >
                          {action.referenceDossier}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Dialog>
    </section>
  );
}
