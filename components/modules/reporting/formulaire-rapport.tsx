"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatErreur, EtatVide } from "@/components/global";
import { MenuExport, MontantFcfa } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { useGenererRapport } from "@/hooks/useReporting";
import { messageErreur } from "@/lib/api/errors";
import { telechargerBlob } from "@/lib/documents";
import { nomFichierRapport, periodeParDefaut, periodeValide } from "@/lib/rapports";
import { reportingService, type PeriodeRapport } from "@/services/reportingService";
import { CategorieDossier, FormatRapport, TypeRapport } from "@/types/enums";
import type { Rapport } from "@/types/domaine";

const FORMATS_BINAIRES = FormatRapport.filter((format) => format !== "JSON") as (
  "PDF" | "EXCEL" | "CSV"
)[];

/**
 * Screen 40 - activity report (FR-REP-01, US 8.4).
 *
 * The report is an action, not a read: nothing is sent until the user picks a period and clicks.
 * Changing the label type recomputes the proposed bounds (see `lib/rapports.ts`) without calling
 * the backend.
 * A 204 is an empty state, not an error (RG-REP-02): an explanation is shown and export is refused.
 */
export function FormulaireRapport() {
  const t = useTranslations("rapports");
  const td = useTranslations("domaine");
  const tCategorie = useTranslations("domaine.CategorieDossier");
  const [periode, setPeriode] = useState<PeriodeRapport>(() => periodeParDefaut("MENSUEL"));
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [affiche, setAffiche] = useState(false);
  const [format, setFormat] = useState<"PDF" | "EXCEL" | "CSV">("PDF");
  const [exportEnCours, setExportEnCours] = useState(false);
  const generer = useGenererRapport();

  const valide = periodeValide(periode);

  function changerType(type: (typeof TypeRapport)[number]) {
    // The type drives the proposed bounds: keeping them would show an "annual" label on three days
    // of data.
    // The scope survives a period label change: it answers another question, and resetting it would
    // force the user to set it again on each try.
    setPeriode((courante) => ({ ...periodeParDefaut(type), categorie: courante.categorie }));
    setAffiche(false);
  }

  function changerBorne(champ: "dateDebut" | "dateFin", valeur: string) {
    setPeriode((precedente) => ({ ...precedente, [champ]: valeur }));
    setAffiche(false);
  }

  function afficher() {
    generer.mutate(periode, {
      onSuccess: (resultat) => {
        setRapport(resultat);
        setAffiche(true);
      },
      onError: (erreur) => toast.error(messageErreur(erreur)),
    });
  }

  async function exporter() {
    setExportEnCours(true);
    try {
      const contenu = await reportingService.exporterRapport(periode, format);
      if (!contenu) {
        // 204: the backend has nothing to produce. Saying so beats an empty file.
        setRapport(null);
        setAffiche(true);
        toast.info(t("exportVide"));
        return;
      }
      telechargerBlob(contenu, nomFichierRapport(periode, format));
      toast.success(t("exportReussi", { format }));
    } catch (error_) {
      toast.error(messageErreur(error_));
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("titre")}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded border border-bordure bg-surface p-3">
        <Champ id="rapport-type" label={t("type")} aide={t("typeAide")} className="w-52">
          <Select
            id="rapport-type"
            value={periode.type}
            onChange={(evenement) =>
              changerType(evenement.target.value as (typeof TypeRapport)[number])
            }
          >
            {TypeRapport.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeRapport.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        {/*
          Category scope, placed before the date bounds because it drives what all seven indicators
          count; placed after, it would seem to concern only the export.
        */}
        <Champ
          id="rapport-perimetre"
          label={t("perimetre")}
          aide={t("perimetreAide")}
          className="w-56"
        >
          <Select
            id="rapport-perimetre"
            value={periode.categorie ?? ""}
            onChange={(evenement) =>
              setPeriode((courante) => ({
                ...courante,
                categorie: (evenement.target.value || undefined) as CategorieDossier | undefined,
              }))
            }
          >
            <option value="">{t("perimetreToutes")}</option>
            {CategorieDossier.map((categorie) => (
              <option key={categorie} value={categorie}>
                {tCategorie(categorie)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="rapport-debut" label={t("dateDebut")} className="w-44">
          <Input
            id="rapport-debut"
            type="date"
            value={periode.dateDebut}
            onChange={(evenement) => changerBorne("dateDebut", evenement.target.value)}
          />
        </Champ>

        <Champ
          id="rapport-fin"
          label={t("dateFin")}
          erreur={valide ? undefined : t("periodeInversee")}
          className="w-44"
        >
          <Input
            id="rapport-fin"
            type="date"
            value={periode.dateFin}
            onChange={(evenement) => changerBorne("dateFin", evenement.target.value)}
          />
        </Champ>

        <Button onClick={afficher} disabled={!valide || generer.isPending}>
          {generer.isPending ? t("enCours") : t("generer")}
        </Button>

        <MenuExport
          formats={FORMATS_BINAIRES}
          valeur={format}
          onChangement={setFormat}
          onExport={() => void exporter()}
          enCours={exportEnCours || !valide}
        />
      </div>

      {generer.error ? <EtatErreur message={messageErreur(generer.error)} /> : null}

      {affiche ? (
        <ResultatRapport rapport={rapport} />
      ) : (
        <p className="text-texte-secondaire">{t("avantGeneration")}</p>
      )}
    </div>
  );
}

/** The compiled indicators; `null` is the 204 of a period without activity. */
function ResultatRapport({ rapport }: Readonly<{ rapport: Rapport | null }>) {
  const t = useTranslations("rapports");
  const td = useTranslations("domaine");

  if (rapport === null) return <EtatVide titre={t("vide")} description={t("videTexte")} />;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--taille-lg)] font-semibold">
        {td(`TypeRapport.${rapport.type}` as never)} ·{" "}
        <span className="font-normal text-texte-secondaire">
          {t("resultatPour", { debut: rapport.dateDebut, fin: rapport.dateFin })}
        </span>
      </h2>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Ligne
          libelle={t("nbNouveauxDossiers")}
          valeur={<span data-nombres>{rapport.nbNouveauxDossiers}</span>}
        />
        <Ligne
          libelle={t("nbAudiencesTenues")}
          valeur={<span data-nombres>{rapport.nbAudiencesTenues}</span>}
        />
        <Ligne
          libelle={t("nbDemandesFraisDeposees")}
          valeur={<span data-nombres>{rapport.nbDemandesFraisDeposees}</span>}
        />
        <Ligne
          libelle={t("nbDeliberesEnregistres")}
          valeur={<span data-nombres>{rapport.nbDeliberesEnregistres}</span>}
        />
        {/*
              Counts, not a percentage. "Lost" is not the complement of "won": a mixed deliberation is
              neither, and has its own line.
            */}
        <Ligne
          libelle={t("nbLitigesGagnes")}
          valeur={<span data-nombres>{rapport.nbLitigesGagnes}</span>}
        />
        <Ligne
          libelle={t("nbLitigesPerdus")}
          valeur={<span data-nombres>{rapport.nbLitigesPerdus}</span>}
        />
        <Ligne
          libelle={t("nbLitigesMixtes")}
          valeur={<span data-nombres>{rapport.nbLitigesMixtes}</span>}
        />
        <Ligne
          libelle={t("provisionsReprises")}
          valeur={<MontantFcfa valeur={rapport.provisionsReprises} />}
        />
      </dl>
    </section>
  );
}

function Ligne({ libelle, valeur }: Readonly<{ libelle: string; valeur: React.ReactNode }>) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-bordure bg-surface p-4">
      <dt className="text-[length:var(--taille-sm)] text-texte-secondaire">{libelle}</dt>
      <dd className="text-[length:var(--taille-xl)] font-semibold tracking-tight">{valeur}</dd>
    </div>
  );
}
