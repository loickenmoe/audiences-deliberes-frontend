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
 * L'activité de chacun sur une période (observation 14, N6).
 *
 * **Des indicateurs, pas une note.** L'application compte ; le responsable apprécie. C'est la ligne
 * arrêtée avec le métier, et elle gouverne ce que cet écran montre comme ce qu'il refuse de
 * montrer : ni note, ni classement, ni total « global » qui ferait d'une somme d'actions disparates
 * un chiffre de mérite. Les lignes suivent l'ordre des **noms** - trier par volume ferait du
 * rapport un palmarès, où le premier passerait pour le meilleur.
 *
 * **Deux indicateurs qu'on pourrait attendre et qui n'y sont pas.** Les dossiers gagnés par
 * personne : l'issue d'un délibéré appartient au dossier, pas à celui qui l'a saisi. Le temps
 * passé : l'application horodate des actions, jamais des durées de travail.
 *
 * **Réservé au DJ et à la DJA.** Le serveur le tient sur leurs rôles propres ; cet écran ne fait
 * que ne pas le proposer aux autres.
 */
export function ActiviteParPersonne() {
  const t = useTranslations("nominatif");
  // Le mois en cours par défaut : c'est la période qu'un responsable regarde le plus souvent, et
  // `periodeDe` la calcule sur le calendrier, non sur les trente derniers jours.
  const defaut = periodeDe("mois");
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const [rapport, setRapport] = useState<RapportNominatif | null>(null);
  const [affiche, setAffiche] = useState(false);
  // La personne dont on regarde la fiche complete. Le tableau compare six colonnes ; la fiche
  // porte tout ce que la personne a fait - c'est la fidelite demandee par le metier (Q-133).
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
        <Button onClick={() => generer.mutate()} disabled={!valide || generer.isPending}>
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
                    {/*
                      Un compte retiré du référentiel laisse ses traces : les afficher sans nom les
                      rendrait anonymes, alors que c'est précisément le « qui » qui est en jeu.
                    */}
                    {/*
                      Le nom ouvre la fiche complete de la personne. Le tableau ne porte que six
                      colonnes pour rester comparable ; tout le reste de son activite est la,
                      derriere son nom.
                    */}
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
                    Sans compte rendu saisi, il n'y a pas de délai à montrer. Zéro se lirait comme
                    une saisie le jour même, c'est-à-dire comme la meilleure performance possible.

                    Le test porte sur le **type**, pas sur `=== null` : le contrat déclare le champ
                    optionnel, et un jour où Jackson omettrait les nuls, `undefined.toFixed()`
                    casserait la page entière pour une seule cellule sans objet.
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
        La fiche s'ouvre **sous** le tableau et non dans une modale : on y choisit une periode, on y
        telecharge, on y clique vers des dossiers. Une modale rendrait tout cela etroit, et la
        navigation vers un dossier la fermerait de toute facon.
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
            utilisateurId={personneOuverte.id}
            nomAffiche={personneOuverte.nom}
          />
        </div>
      ) : null}
    </section>
  );
}
