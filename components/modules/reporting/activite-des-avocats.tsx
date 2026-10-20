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
import type { CibleActivite } from "@/services/reportingService";
import type { RapportAvocats } from "@/types/domaine";

/**
 * Lawyers' activity over a period - DJ and DJA only.
 *
 * A separate table rather than extra columns in "Activité par personne": that table counts internal
 * production (opening case files, scheduling hearings, recording reports and deliberations, drafting
 * letters, checking expenses) which lawyers never perform - they submit, legal officers record.
 *
 * Same rule as for internal profiles: no score, no volume ranking, no total. Rows are sorted by name,
 * since a heavily loaded lawyer is not a more deserving one.
 */
export function ActiviteDesAvocats() {
  const t = useTranslations("avocatsActivite");
  const defaut = periodeDe("mois");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const [rapport, setRapport] = useState<RapportAvocats | null>(null);
  const [affiche, setAffiche] = useState(false);
  const [ouvert, setOuvert] = useState<{ cible: CibleActivite; nom: string } | null>(null);

  const valide = debut <= fin;

  const generer = useMutation({
    mutationFn: () => reportingService.rapportAvocats(debut, fin),
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
        <Champ id="avocats-debut" label={t("dateDebut")} className="w-44">
          <Input
            id="avocats-debut"
            type="date"
            value={debut}
            onChange={(evenement) => setDebut(evenement.target.value)}
          />
        </Champ>
        <Champ
          id="avocats-fin"
          label={t("dateFin")}
          erreur={valide ? undefined : t("periodeInversee")}
          className="w-44"
        >
          <Input
            id="avocats-fin"
            type="date"
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
          />
        </Champ>
        {/* Same reason as for the internal profiles table: the accessible name says which table. */}
        <Button
          onClick={() => generer.mutate()}
          disabled={!valide || generer.isPending}
          aria-label={t("afficherAccessible")}
        >
          {generer.isPending ? t("enCours") : t("afficher")}
        </Button>
      </div>

      {generer.error ? <EtatErreur message={messageErreur(generer.error)} /> : null}

      {affiche ? (
        <ResultatAvocats rapport={rapport} onOuvrir={setOuvert} />
      ) : (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("avantGeneration")}
        </p>
      )}

      {ouvert === null ? null : (
        <div className="flex flex-col gap-2">
          <Button variante="discrete" className="self-start" onClick={() => setOuvert(null)}>
            {t("fermerFiche")}
          </Button>
          <FicheActivite key={ouvert.nom} cible={ouvert.cible} nomAffiche={ouvert.nom} />
        </div>
      )}
    </section>
  );
}

/** The displayed table, one row per lawyer; a name opens that lawyer's sheet. */
function ResultatAvocats({
  rapport,
  onOuvrir,
}: Readonly<{
  rapport: RapportAvocats | null;
  onOuvrir: (ouvert: { cible: CibleActivite; nom: string }) => void;
}>) {
  const t = useTranslations("avocatsActivite");

  if (rapport === null) return <EtatVide titre={t("vide")} description={t("videTexte")} />;
  return (
    <div className="overflow-x-auto rounded border border-bordure bg-surface">
      <table className="w-full text-left text-[length:var(--taille-sm)]">
        <caption className="sr-only">
          {t("legende", { debut: rapport.dateDebut, fin: rapport.dateFin })}
        </caption>
        <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneAvocat")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneComptesRendus")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneFrais")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneAutresDepots")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium" title={t("explicationsAide")}>
              {t("colonneExplications")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bordure">
          {rapport.lignes.map((ligne) => (
            <tr key={ligne.utilisateurId}>
              <td className="px-4 py-2 font-medium">
                {/*
                      The name opens their full activity sheet. The lawyer is designated by their directory record
                      when they have one, otherwise by their account if the record was removed: their submissions
                      remain counted and must stay viewable.
                    */}
                <button
                  type="button"
                  className="text-left text-lien underline hover:no-underline"
                  onClick={() =>
                    onOuvrir({
                      cible:
                        ligne.avocatId === null
                          ? { utilisateurId: ligne.utilisateurId }
                          : { avocatId: ligne.avocatId },
                      nom: ligne.nom ?? t("avocatSansNom", { identifiant: ligne.utilisateurId }),
                    })
                  }
                >
                  {ligne.nom ?? t("avocatSansNom", { identifiant: ligne.utilisateurId })}
                </button>
                {ligne.avocatId === null ? (
                  <span className="block text-[length:var(--taille-xs)] font-normal text-texte-tertiaire">
                    {t("horsRepertoire")}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2" data-nombres>
                {ligne.comptesRendusDeposes}
              </td>
              <td className="px-4 py-2" data-nombres>
                {ligne.demandesFraisDeposees}
              </td>
              <td className="px-4 py-2" data-nombres>
                {ligne.autresPublicationsDeposees}
              </td>
              <td className="px-4 py-2" data-nombres>
                {ligne.explicationsFournies}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
