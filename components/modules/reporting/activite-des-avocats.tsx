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
 * L'activité des avocats sur une période (Q-136) — DJ et DJA.
 *
 * **Pourquoi un second tableau, et non quatre colonnes de plus.** Le porteur du projet l'a relevé le
 * 2026-10-13 : « Activité par personne » ne montrait que les profils internes. C'était exact, et ce
 * n'était pas réparable en y ajoutant les avocats - ce tableau-là compte six natures de **production
 * interne** - ouvrir un dossier, planifier une audience, enregistrer un compte rendu, un délibéré,
 * rédiger une lettre, contrôler des frais - dont un avocat n'accomplit **aucune**. Il **dépose** ;
 * c'est le juriste qui enregistre. L'y faire figurer n'aurait affiché qu'une ligne de zéros, soit
 * exactement ce que la conception refuse.
 *
 * **Deux populations, deux jeux d'indicateurs, une même règle.** Les avocats se comparent entre eux
 * sur ce qu'ils font réellement. Ni note, ni classement par volume, ni total : les lignes suivent
 * l'ordre des **noms** - un avocat chargé n'est pas un avocat méritant, c'est la banque qui lui
 * confie ses dossiers.
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
        {/* Même raison que pour le tableau des internes : le nom accessible dit lequel. */}
        <Button
          onClick={() => generer.mutate()}
          disabled={!valide || generer.isPending}
          aria-label={t("afficherAccessible")}
        >
          {generer.isPending ? t("enCours") : t("afficher")}
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
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneAvocat")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneComptesRendus")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneFrais")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneAutresDepots")}</th>
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
                      Le nom ouvre sa fiche complète. L'avocat est désigné par son **inscription**
                      quand il en a une - c'est ainsi que la direction le connaît - et par son
                      compte si elle a été retirée depuis : ses dépôts restent comptés, et il faut
                      bien pouvoir les regarder.
                    */}
                    <button
                      type="button"
                      className="text-left text-lien underline hover:no-underline"
                      onClick={() =>
                        setOuvert({
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
                  <td className="px-4 py-2" data-nombres>{ligne.comptesRendusDeposes}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.demandesFraisDeposees}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.autresPublicationsDeposees}</td>
                  <td className="px-4 py-2" data-nombres>{ligne.explicationsFournies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ouvert !== null ? (
        <div className="flex flex-col gap-2">
          <Button variante="discrete" className="self-start" onClick={() => setOuvert(null)}>
            {t("fermerFiche")}
          </Button>
          <FicheActivite
            key={ouvert.nom}
            cible={ouvert.cible}
            nomAffiche={ouvert.nom}
          />
        </div>
      ) : null}
    </section>
  );
}
