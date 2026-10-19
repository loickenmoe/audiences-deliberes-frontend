"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatErreur, EtatVide } from "@/components/global";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { messageErreur } from "@/lib/api/errors";
import { periodeDe } from "@/lib/periodes";
import { reportingService } from "@/services/reportingService";
import type { RapportNominatif } from "@/types/domaine";

/**
 * Each person's activity over a period.
 *
 * Indicators, not a score: the application counts, the manager assesses. Hence no score, no ranking
 * and no overall total; rows are sorted by name, since sorting by volume would turn it into a ranking.
 * Deliberately absent: cases won per person (the outcome belongs to the case file, not to whoever
 * recorded it) and time spent (the application timestamps actions, not working time).
 * Restricted to the DJ and DJA: enforced by the server on their own roles; this screen only hides it.
 */
export function ActiviteParPersonne() {
  const t = useTranslations("nominatif");
  // Current month by default: the period a manager looks at most often. `periodeDe` computes it on
  // the calendar, not on the last thirty days.
  const defaut = periodeDe("mois");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const [rapport, setRapport] = useState<RapportNominatif | null>(null);
  const [affiche, setAffiche] = useState(false);
  // The person whose full sheet is open. The table compares six columns; the sheet shows everything
  // the person did.
  const [personneOuverte, setPersonneOuverte] = useState<{ id: number; nom: string } | null>(null);

  const valide = debut <= fin;

  const generer = useMutation({
    mutationFn: () => reportingService.rapportNominatif(debut, fin),
    onSuccess: (resultat) => {
      setRapport(resultat);
      setAffiche(true);
    },
  });

  return (
    <section className="flex flex-col gap-4 border-t border-bordure pt-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--taille-lg)] font-semibold">{t("titre")}</h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("description")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded border border-bordure bg-surface p-3">
        <Champ id="nominatif-debut" label={t("dateDebut")} className="w-44">
          <Input
            id="nominatif-debut"
            type="date"
            value={debut}
            onChange={(evenement) => setDebut(evenement.target.value)}
          />
        </Champ>
        <Champ
          id="nominatif-fin"
          label={t("dateFin")}
          erreur={valide ? undefined : t("periodeInversee")}
          className="w-44"
        >
          <Input
            id="nominatif-fin"
            type="date"
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
          />
        </Champ>
        {/*
          The visible text stays "Afficher", but the accessible name says what: two tables share this
          screen, each with its own button.
        */}
        <Button
          onClick={() => generer.mutate()}
          disabled={!valide || generer.isPending}
          aria-label={t("genererAccessible")}
        >
          {generer.isPending ? t("enCours") : t("generer")}
        </Button>
      </div>

      {generer.error ? <EtatErreur message={messageErreur(generer.error)} /> : null}

      {!affiche ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("avantGeneration")}</p>
      ) : rapport === null ? (
        <EtatVide titre={t("vide")} description={t("videTexte")} />
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <caption className="sr-only">
              {t("legende", { debut: rapport.dateDebut, fin: rapport.dateFin })}
            </caption>
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePersonne")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDossiers")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneAudiences")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneComptesRendus")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDeliberes")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneLettres")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneFrais")}</th>
                <th scope="col" className="px-4 py-2 font-medium" title={t("delaiAide")}>
                  {t("colonneDelai")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {rapport.lignes.map((ligne) => (
                <tr key={ligne.utilisateurId}>
                  <td className="px-4 py-2 font-medium">
                    {/* An account removed from the directory keeps its records: showing them without a name would make them anonymous. */}
                    {/* The name opens the person's full sheet; the table keeps six columns to stay comparable. */}
                    <button
                      type="button"
                      className="text-left text-lien underline hover:no-underline"
                      onClick={() =>
                        setPersonneOuverte({
                          id: ligne.utilisateurId,
                          nom: ligne.nom ?? t("personneRetiree", { identifiant: ligne.utilisateurId }),
                        })
                      }
                    >
                      {ligne.nom ?? t("personneRetiree", { identifiant: ligne.utilisateurId })}
                    </button>
                    {ligne.profil ? (
                      <span className="block text-[length:var(--taille-xs)] font-normal text-texte-tertiaire">
                        {ligne.profil}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2" data-nombres>{ligne.dossiersOuverts}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.audiencesPlanifiees}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.comptesRendusSaisis}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.deliberesEnregistres}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.lettresRedigees}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.fraisTraites}</td>
                  {/*
                    Without a hearing report there is no delay to show: zero would read as same-day entry, the best
                    possible performance. The check is on the type, not `=== null`: the contract declares the field
                    optional, and an omitted value would make `undefined.toFixed()` crash the page.
                  */}
                  <td className="px-4 py-2" data-nombres>
                    {typeof ligne.delaiMoyenSaisieCompteRendu === "number"
                      ? t("delaiJours", { jours: ligne.delaiMoyenSaisieCompteRendu.toFixed(1) })
                      : t("delaiSansObjet")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/*
        The sheet opens below the table rather than in a modal: it has a period picker, downloads and
        links to case files, and navigating to a case file would close a modal anyway.
      */}
      {personneOuverte !== null ? (
        <div className="flex flex-col gap-2">
          <Button
            variante="discrete"
            className="self-start"
            onClick={() => setPersonneOuverte(null)}
          >
            {t("fermerFiche")}
          </Button>
          <FicheActivite
            key={personneOuverte.id}
            cible={{ utilisateurId: personneOuverte.id }}
            nomAffiche={personneOuverte.nom}
          />
        </div>
      ) : null}
    </section>
  );
}
