"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { DateValeur, MontantFcfa } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { useCalendrier } from "@/hooks/useAudiences";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import { debutDePeriode, decalerPeriode, finDePeriode, versIso } from "@/lib/calendrier";
import { telechargerBlob } from "@/lib/documents";
import type { Langue } from "@/i18n/config";
import { cn, formaterDate } from "@/lib/utils";
import { audienceService } from "@/services/audienceService";
import type { EntreeCalendrier } from "@/types/domaine";
import { PeriodeCalendrier, TypeEtape } from "@/types/enums";

/**
 * Screen 22 - hearing calendar (FR-AUD-05).
 * Shown as an agenda (one list per day) rather than a grid, which would be unreadable over a
 * quarter. The three backend periods are aligned on natural boundaries (Monday, 1st of the month,
 * 1st of the quarter).
 * The backend returns all hearings of the period, not filtered by lawyer: the logged-in user's id
 * is not exposed.
 */
export function CalendrierAudiences() {
  const t = useTranslations("calendrier");
  const tdom = useTranslations("domaine");
  const tc = useTranslations("commun");
  const langue = useLocale() as Langue;
  const { nomUtilisateur, nomIntervenant } = useLibelles();
  const [periode, setPeriode] = useState<PeriodeCalendrier>("HEBDOMADAIRE");
  const [debut, setDebut] = useState(() => debutDePeriode("HEBDOMADAIRE", new Date()));
  const [exportEnCours, setExportEnCours] = useState<"PDF" | "EXCEL" | null>(null);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  const dateDebut = versIso(debut);
  const requete = useCalendrier(periode, dateDebut);

  function changerPeriode(nouvelle: PeriodeCalendrier) {
    setPeriode(nouvelle);
    setDebut(debutDePeriode(nouvelle, debut));
  }

  async function exporter(format: "PDF" | "EXCEL") {
    setErreurExport(null);
    setExportEnCours(format);
    try {
      const contenu = await audienceService.exporterCalendrier(periode, dateDebut, format);
      // File name built here: the Content-Disposition header is not exposed through CORS, and a
      // dated name is more useful than "calendrier.pdf" when archiving several.
      telechargerBlob(contenu, `calendrier-${periode.toLowerCase()}-${dateDebut}.${format === "PDF" ? "pdf" : "xlsx"}`);
    } catch (error_) {
      setErreurExport(messageErreur(error_));
    } finally {
      setExportEnCours(null);
    }
  }

  const entrees = requete.data ?? [];
  const parJour = new Map<string, EntreeCalendrier[]>();
  for (const entree of [...entrees].sort((a, b) => a.datePlanifiee.localeCompare(b.datePlanifiee))) {
    parJour.set(entree.datePlanifiee, [...(parJour.get(entree.datePlanifiee) ?? []), entree]);
  }

  const libelleEtape = (etape: string) =>
    (TypeEtape as readonly string[]).includes(etape) ? tdom(`TypeEtape.${etape}` as never) : etape;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-bordure bg-surface p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t("periode")} className="flex rounded border border-bordure-forte">
            {PeriodeCalendrier.map((valeur) => (
              <button
                key={valeur}
                type="button"
                aria-pressed={valeur === periode}
                onClick={() => changerPeriode(valeur)}
                className={cn(
                  "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
                  valeur === periode ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
                )}
              >
                {tdom(`PeriodeCalendrier.${valeur}` as never)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variante="secondaire"
              taille="sm"
              onClick={() => setDebut(decalerPeriode(periode, debut, -1))}
              aria-label={t("precedente")}
            >
              <ChevronLeft size={16} aria-hidden />
            </Button>
            <Button variante="secondaire" taille="sm" onClick={() => setDebut(debutDePeriode(periode, new Date()))}>
              {t("aujourdhui")}
            </Button>
            <Button
              variante="secondaire"
              taille="sm"
              onClick={() => setDebut(decalerPeriode(periode, debut, 1))}
              aria-label={t("suivante")}
            >
              <ChevronRight size={16} aria-hidden />
            </Button>
          </div>

          <p className="text-[length:var(--taille-sm)] font-medium" aria-live="polite">
            {/* `{debut}` is a simple argument that only accepts text, so dates are formatted here. */}
            {t("intervalle", {
              debut: formaterDate(dateDebut, langue),
              fin: formaterDate(versIso(finDePeriode(periode, debut)), langue),
            })}
            <span className="ml-2 font-normal text-texte-secondaire">· {t("nombre", { nombre: entrees.length })}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variante="secondaire" taille="sm" onClick={() => void exporter("PDF")} disabled={exportEnCours !== null}>
            <Download size={14} aria-hidden />
            {t("exporterPdf")}
          </Button>
          <Button variante="secondaire" taille="sm" onClick={() => void exporter("EXCEL")} disabled={exportEnCours !== null}>
            <Download size={14} aria-hidden />
            {t("exporterExcel")}
          </Button>
        </div>
      </div>

      {erreurExport ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {erreurExport}
        </p>
      ) : null}

      {requete.isLoading ? (
        <EtatChargement lignes={6} />
      ) : requete.error ? (
        <EtatErreur
          message={messageErreur(requete.error)}
          action={
            <Button variante="secondaire" onClick={() => void requete.refetch()}>
              {tc("reessayer")}
            </Button>
          }
        />
      ) : parJour.size === 0 ? (
        <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
          {t("aucune")}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...parJour.entries()].map(([jour, audiences]) => (
            <section key={jour} aria-labelledby={`jour-${jour}`} className="flex flex-col gap-2">
              <h2 id={`jour-${jour}`} className="text-[length:var(--taille-base)] font-semibold capitalize">
                <DateValeur valeur={jour} />
              </h2>
              <div className="overflow-x-auto rounded border border-bordure bg-surface">
                <table className="w-full text-left text-[length:var(--taille-sm)]">
                  <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">{t("colonneDossier")}</th>
                      <th scope="col" className="px-4 py-2 font-medium">{t("colonneClient")}</th>
                      <th scope="col" className="px-4 py-2 font-medium">{t("colonneJuridiction")}</th>
                      <th scope="col" className="px-4 py-2 font-medium">{t("colonneEtape")}</th>
                      <th scope="col" className="px-4 py-2 font-medium">{t("colonneJuristes")}</th>
                      <th scope="col" className="px-4 py-2 font-medium">{t("colonneAvocats")}</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">{t("colonneRisque")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure">
                    {audiences.map((audience) => (
                      <tr key={audience.audienceId}>
                        <td className="px-4 py-2">
                          <Link
                            href={`/dossiers/${audience.dossierId}`}
                            className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
                          >
                            {audience.referenceDossier}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{audience.clientNom ?? "—"}</td>
                        <td className="px-4 py-2">{audience.juridiction}</td>
                        <td className="px-4 py-2">{libelleEtape(audience.etape)}</td>
                        <td className="px-4 py-2">{audience.juristesAffectes.map(nomUtilisateur).join(", ") || "—"}</td>
                        <td className="px-4 py-2">{audience.avocatsAffectes.map(nomIntervenant).join(", ") || "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <MontantFcfa valeur={audience.risqueEncouru} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
