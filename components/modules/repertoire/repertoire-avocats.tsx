"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { ChampRecherche } from "@/components/metier";
import { FicheActivite } from "@/components/modules/reporting/fiche-activite";
import { Button } from "@/components/ui/button";
import { useRepertoire } from "@/hooks/useConstitutions";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";

const DEFAUTS = { nom: "" };

/**
 * Screen 34 - lawyer directory (UC-INT-07), from least to most loaded: the useful order when choosing
 * whom to entrust a case file to. Load counts active case files; performance is the share of
 * favorable deliberations on their case files (0% until one is delivered).
 */
export function RepertoireAvocats({ roles }: Readonly<{ roles: string[] }>) {
  const t = useTranslations("repertoire");
  const { filtres, definirFiltre } = useFiltresUrl(DEFAUTS);
  const requete = useRepertoire(filtres.nom);
  const avocats = requete.data?.content ?? [];
  /*
    A lawyer's activity names a person: it is restricted to the DJ and DJA's own roles, never to
    `ROLE_JURISTE`, which is composite - otherwise every legal officer, and the Assistant who also
    reaches this screen, could read it.
  */
  const peutLireLActivite = peut(roles, "consulterRapportNominatif");
  const [avocatOuvert, setAvocatOuvert] = useState<{ id: number; nom: string } | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      {/* Filters as the user types, like the case file and client filters; `ChampRecherche` keeps the Enter shortcut. */}
      <ChampRecherche
        id="recherche-avocat"
        label={t("rechercheNom")}
        placeholder={t("phRechercheAvocat")}
        valeur={filtres.nom}
        onChangement={(valeur) => definirFiltre("nom", valeur.trim() || undefined)}
        className="w-64"
      />

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
                {/* Added last on purpose: two e2e tests target the load column by its position (4th column). */}
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
                    Counts, not a rate: "3 of 4" also says how many cases the figure is based on. No deliberation
                    means no measurement, not poor performance, so the screen says so instead of showing a zero.
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
        The detail opens below the table rather than in a modal: it has a period picker and downloads.
        `key` forces a remount when the lawyer changes, otherwise the previous period and report would remain.
      */}
      {avocatOuvert === null ? null : (
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
      )}
    </div>
  );
}
