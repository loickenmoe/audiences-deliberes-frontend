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
import { reportingService } from "@/services/reportingService";
import type { ActionDetaillee, RapportActivite } from "@/types/domaine";

/**
 * L'onglet de la fiche dossier ou chaque nature d'action se regarde.
 *
 * **Les neuf onglets sont ceux de `fiche-dossier.tsx`, et il n'y en a pas d'autres.** Une premiere
 * version de cette carte envoyait les cinq natures de frais sur un onglet « frais » qui **n'existe
 * pas** : la fiche dossier n'en a pas, les demandes de frais vivant sur leur propre ecran. Rien ne
 * cassait - l'onglet inconnu retombe sur la synthese - mais la promesse « sur l'onglet
 * correspondant » etait fausse, et aucun test ne le disait. D'ou l'assertion ci-dessous.
 *
 * Une nature **absente** de cette carte ouvre la **synthese** du dossier, et c'est voulu : mieux
 * vaut arriver sur le dossier concerne que ne pas pouvoir cliquer. C'est le cas des frais, dont
 * l'action ne porte que le dossier et non la demande, et de tout ce qui touche au dossier lui-meme
 * - affectation, sensibilite, derogation de seuil.
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
 * Où mène un clic sur une action.
 *
 * **Une nature non cartographiée ouvre la synthèse du dossier**, et c'est volontaire : la liste
 * ci-dessus couvre les natures qui ont un onglet dédié, et les cinquante-trois codes évoluent. Mieux
 * vaut arriver sur le dossier concerné que ne pas pouvoir cliquer - et ouvrir un onglet inexistant
 * ramènerait de toute façon à la synthèse.
 */
function lienVers(action: ActionDetaillee): string | null {
  if (action.dossierId === null) return null;
  const onglet = ONGLET_PAR_NATURE[action.code];
  return onglet ? `/dossiers/${action.dossierId}?onglet=${onglet}` : `/dossiers/${action.dossierId}`;
}

/**
 * La fiche d'activité d'une personne (Q-133).
 *
 * **Deux demandes du métier du 2026-10-09 vivent ici.** « Chaque utilisateur doit être capable de
 * télécharger ses propres rapports, dépendamment de la période choisie » : d'où les trois formats,
 * sur la période que l'utilisateur fixe. Et « cliquer sur un élément doit directement le renvoyer
 * aux détails de la dite tâche » : d'où le décompte cliquable, qui ouvre les actions comptées, puis
 * le dossier concerné.
 *
 * **Fidèle, et non comparable.** Le tableau de la direction tient sur six colonnes pour que des
 * personnes se comparent ; cette fiche porte **toutes** les natures accomplies, parce qu'une
 * Assistante ou un supérieur hiérarchique n'ouvre pas de dossiers et qu'un tableau à six colonnes
 * les montrerait vides. C'est l'arbitrage du métier, qui a renversé le mien.
 *
 * **Ni note, ni total**, comme le tableau nominatif : additionner des gestes de natures différentes
 * fabriquerait un chiffre de mérite que rien ne justifie.
 *
 * @param utilisateurId une personne précise - réservé au DJ et à la DJA, le serveur le vérifie.
 *                      Absent, la fiche est celle de l'utilisateur connecté.
 */
export function FicheActivite({
  utilisateurId,
  nomAffiche,
}: {
  utilisateurId?: number;
  nomAffiche?: string;
}) {
  const t = useTranslations("activite");
  const tNatures = useTranslations("historique.actions");
  const defaut = periodeDe("mois");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const [format, setFormat] = useState<keyof typeof EXTENSION_RAPPORT>("PDF");
  const [rapport, setRapport] = useState<RapportActivite | null>(null);
  const [affiche, setAffiche] = useState(false);
  // La nature dont on regarde le détail. `null` quand la modale est fermée : garder la dernière
  // ouverte ferait réapparaître un contenu périmé au prochain clic.
  const [natureOuverte, setNatureOuverte] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const autre = utilisateurId !== undefined;
  const valide = debut <= fin;

  const generer = useMutation({
    mutationFn: () => reportingService.rapportActivite(debut, fin, utilisateurId),
    onSuccess: (resultat) => {
      setRapport(resultat);
      setAffiche(true);
    },
  });

  const telecharger = useMutation({
    mutationFn: async () => {
      const contenu = await reportingService.exporterActivite(debut, fin, format, utilisateurId);
      if (contenu === null) return;
      // Le nom vient d'ici : `Content-Disposition` n'est pas exposé en CORS, et le serveur applique
      // la même règle de son côté (`nomFichierActivite`).
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
    queryKey: ["activite-details", utilisateurId ?? "moi", natureOuverte, debut, fin, page],
    queryFn: () => reportingService.detailsActivite(natureOuverte!, debut, fin, page, utilisateurId),
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
          {autre ? t("titreAutre", { personne: nomAffiche ?? String(utilisateurId) }) : t("titre")}
        </h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {autre ? t("descriptionAutre") : t("description")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded border border-bordure bg-surface p-3">
        <Champ id={`activite-debut-${utilisateurId ?? "moi"}`} label={t("dateDebut")} className="w-44">
          <Input
            id={`activite-debut-${utilisateurId ?? "moi"}`}
            type="date"
            value={debut}
            onChange={(evenement) => setDebut(evenement.target.value)}
          />
        </Champ>
        <Champ
          id={`activite-fin-${utilisateurId ?? "moi"}`}
          label={t("dateFin")}
          erreur={valide ? undefined : t("periodeInversee")}
          className="w-44"
        >
          <Input
            id={`activite-fin-${utilisateurId ?? "moi"}`}
            type="date"
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
          />
        </Champ>
        <Button onClick={() => generer.mutate()} disabled={!valide || generer.isPending}>
          {generer.isPending ? t("enCours") : t("afficher")}
        </Button>

        {/*
          Le téléchargement n'apparaît qu'une fois la fiche affichée. Proposer d'emporter un
          document qu'on n'a pas vu invite à télécharger une période vide, puis à ouvrir un fichier
          pour découvrir qu'il ne contient rien.
        */}
        {rapport !== null ? (
          <>
            <Champ
              id={`activite-format-${utilisateurId ?? "moi"}`}
              label={t("formatExport")}
              className="w-32"
            >
              <Select
                id={`activite-format-${utilisateurId ?? "moi"}`}
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
                          Le décompte lui-même n'est pas le bouton : un nombre cliquable ne se
                          signale pas comme tel, et un lecteur d'écran annoncerait « 4 » sans dire
                          ce qu'il ouvre. Le bouton porte la nature et le nombre.
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
            Le délai moyen est hors du tableau : ce n'est pas un décompte d'actions, et le mêler aux
            autres lignes laisserait croire qu'il s'additionne avec elles. Absent - et non à zéro -
            quand aucun compte rendu n'a été saisi : zéro se lirait comme une saisie le jour même.
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
                const lien = lienVers(action);
                return (
                  <tr key={action.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{action.dateAction.slice(0, 10)}</td>
                    <td className="py-2 pr-4">{action.action}</td>
                    <td className="py-2">
                      {/*
                        Trois états, et chacun dit quelque chose de différent : une action hors
                        dossier (une configuration, un référentiel) n'a rien à ouvrir ; un dossier
                        supprimé depuis a existé ; et le cas courant mène à la fiche.
                      */}
                      {lien === null ? (
                        <span className="text-texte-tertiaire">{t("detailHorsDossier")}</span>
                      ) : action.referenceDossier === null ? (
                        <span className="text-texte-tertiaire">{t("detailDossierSupprime")}</span>
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
