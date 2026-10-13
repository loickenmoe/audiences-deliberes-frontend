"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useRepertoire } from "@/hooks/useConstitutions";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";

const DEFAUTS = { nom: "" };

/**
 * Écran 34 — répertoire des avocats (UC-INT-07), du moins chargé au plus chargé : c'est l'ordre
 * utile pour choisir à qui confier un dossier. La charge compte les dossiers actifs ; la performance,
 * la part des délibérés favorables sur ses dossiers (0 % tant qu'aucun n'est rendu).
 */
export function RepertoireAvocats({ roles }: { roles: string[] }) {
  const t = useTranslations("repertoire");
  const { filtres, definirFiltre } = useFiltresUrl(DEFAUTS);
  const requete = useRepertoire(filtres.nom);
  const avocats = requete.data?.content ?? [];
  /*
    L'activité d'un avocat **nomme une personne** : elle se tient sur les rôles propres du DJ et de
    la DJA, jamais sur `ROLE_JURISTE`, composite depuis Q-81 - sans quoi chaque juriste, et
    l'Assistante qui atteint aussi cet écran, liraient ce qu'elle protège.
  */
  const peutLireLActivite = peut(roles, "consulterRapportNominatif");
  const [avocatOuvert, setAvocatOuvert] = useState<{ id: number; nom: string } | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <Champ id="recherche-avocat" label={t("rechercheNom")} className="w-64">
        <Input
          id="recherche-avocat"
          placeholder={t("phRechercheAvocat")}
          defaultValue={filtres.nom}
          // Au `blur` : écrire dans l'URL à chaque frappe produirait une requête par caractère.
          onBlur={(evenement) => definirFiltre("nom", evenement.target.value.trim() || undefined)}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") definirFiltre("nom", evenement.currentTarget.value.trim() || undefined);
          }}
        />
      </Champ>

      {requete.isLoading ? (
        <EtatChargement lignes={5} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : avocats.length === 0 ? (
        <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
          {filtres.nom ? t("videRecherche") : t("vide")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneAvocat")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneCourriel")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneTelephone")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneCharge")}</th>
                <th scope="col" className="px-4 py-2 font-medium" title={t("performanceAide")}>{t("colonnePerformance")}</th>
                {/*
                  Ajoutée **en dernier**, et c'est volontaire : deux parcours e2e visent la charge
                  par son rang (4e colonne). Insérer au milieu les aurait fait échouer sans que le
                  produit ait changé.
                */}
                {peutLireLActivite ? (
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneActivite")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {avocats.map((avocat) => (
                <tr key={avocat.id}>
                  <td className="px-4 py-2 font-medium">{avocat.nom}</td>
                  <td className="px-4 py-2">
                    {avocat.email ? (
                      <a href={`mailto:${avocat.email}`} className="underline underline-offset-4">{avocat.email}</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2">{avocat.telephone ?? "—"}</td>
                  <td className="px-4 py-2" data-nombres>{t("charge", { nombre: avocat.indicateurCharge })}</td>
                  {/*
                    Les chiffres, non le taux (métier, 2026-10-06). « 3 sur 4 » dit ce que « 75 % »
                    résumait, **et sur combien d'affaires** : un taux de 100 % sur un délibéré
                    unique ne vaut pas le même jugement qu'un taux de 70 % sur trente, et c'est
                    pourtant le premier qui paraissait le meilleur.

                    Aucun délibéré n'est pas une contre-performance : c'est l'absence de mesure, et
                    l'écran le dit plutôt que d'afficher un zéro qui se lirait comme un échec.
                  */}
                  <td className="px-4 py-2" data-nombres>
                    {avocat.deliberesTotal === 0
                      ? t("aucunDelibere")
                      : t("deliberesGagnes", {
                          gagnes: avocat.deliberesFavorables,
                          total: avocat.deliberesTotal,
                        })}
                  </td>
                  {peutLireLActivite ? (
                    <td className="px-4 py-2">
                      <Button
                        variante="discrete"
                        onClick={() => setAvocatOuvert({ id: avocat.id, nom: avocat.nom })}
                      >
                        {t("voirActivite")}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("performanceAide")}</p>

      {/*
        La fiche s'ouvre **sous** le tableau et non en modale : on y choisit une période, on y
        télécharge, et une modale rendrait tout cela étroit. `key` force un remontage au changement
        d'avocat, sans quoi la période et le rapport déjà affichés resteraient ceux du précédent.
      */}
      {avocatOuvert !== null ? (
        <div className="flex flex-col gap-2">
          <Button variante="discrete" className="self-start" onClick={() => setAvocatOuvert(null)}>
            {t("fermerActivite")}
          </Button>
          <FicheActivite
            key={avocatOuvert.id}
            cible={{ avocatId: avocatOuvert.id }}
            nomAffiche={avocatOuvert.nom}
          />
        </div>
      ) : null}
    </div>
  );
}
