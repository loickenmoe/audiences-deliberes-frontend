"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useRapportJournalier } from "@/hooks/useGed";
import type { Langue } from "@/i18n/config";
import { messageErreur } from "@/lib/api/errors";
import { aujourdhui } from "@/lib/calendrier";
import { formaterDate } from "@/lib/utils";

/**
 * Écran 37 — rapport journalier GED (UC-GED-04, FR-GED-04) : dossiers manipulés, pièces ajoutées,
 * affaires nouvelles et audiences planifiées d'une journée. Un jour sans activité n'est pas une
 * erreur : le backend rend des zéros, l'écran le dit en clair.
 */
export function RapportJournalierGed() {
  const t = useTranslations("rapportJournalier");
  const langue = useLocale() as Langue;
  const [date, setDate] = useState(aujourdhui());
  const requete = useRapportJournalier(date);
  const rapport = requete.data;
  const vide =
    rapport !== undefined &&
    rapport.dossiersManipules === 0 &&
    rapport.piecesAjoutees === 0 &&
    rapport.affairesNouvelles === 0 &&
    rapport.planificationActes.length === 0;

  const indicateurs = rapport
    ? [
        { cle: "dossiersManipules", valeur: rapport.dossiersManipules },
        { cle: "piecesAjoutees", valeur: rapport.piecesAjoutees },
        { cle: "affairesNouvelles", valeur: rapport.affairesNouvelles },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Champ id="rapport-date" label={t("champDate")} className="w-56">
          <Input id="rapport-date" type="date" max={aujourdhui()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Champ>
        <Button variante="secondaire" onClick={() => setDate(aujourdhui())}>
          {t("aujourdhui")}
        </Button>
      </div>

      {requete.isLoading ? (
        <EtatChargement lignes={4} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : rapport ? (
        <section aria-label={t("rapportDu", { date: formaterDate(rapport.date, langue) })} className="flex flex-col gap-5">
          {vide ? (
            <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center">
              <p className="font-medium">{t("vide")}</p>
              <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("videTexte")}</p>
            </div>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-3">
            {indicateurs.map(({ cle, valeur }) => (
              <div key={cle} className="rounded border border-bordure bg-surface p-4">
                <dt className="text-[length:var(--taille-sm)] text-texte-secondaire">{t(cle as never)}</dt>
                <dd className="text-[length:var(--taille-2xl)] font-semibold" data-nombres>
                  {valeur}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-2">
            <h2 className="text-[length:var(--taille-base)] font-semibold">{t("planification")}</h2>
            {rapport.planificationActes.length === 0 ? (
              <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("aucuneAudience")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-bordure rounded border border-bordure bg-surface">
                {rapport.planificationActes.map((acte, index) => (
                  <li key={`${acte.dossierId}-${index}`} className="px-4 py-2">
                    <Link
                      href={`/dossiers/${acte.dossierId}?onglet=audiences`}
                      className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
                    >
                      {acte.reference}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
