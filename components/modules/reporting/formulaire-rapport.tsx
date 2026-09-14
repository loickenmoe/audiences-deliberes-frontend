"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatErreur, EtatVide } from "@/components/global";
import { MenuExport, MontantFcfa, Pourcentage } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { useGenererRapport } from "@/hooks/useReporting";
import { messageErreur } from "@/lib/api/errors";
import { telechargerBlob } from "@/lib/documents";
import { nomFichierRapport, periodeParDefaut, periodeValide } from "@/lib/rapports";
import { reportingService, type PeriodeRapport } from "@/services/reportingService";
import { FormatRapport, TypeRapport } from "@/types/enums";
import type { Rapport } from "@/types/domaine";

const FORMATS_BINAIRES = FormatRapport.filter((format) => format !== "JSON") as ("PDF" | "EXCEL" | "CSV")[];

/**
 * Écran 40 — rapport d'activité (FR-REP-01, US 8.4).
 *
 * Le rapport est une **action**, pas une lecture : rien ne part tant que l'utilisateur n'a pas
 * choisi sa période et cliqué. Changer le type d'étiquette recalcule les bornes proposées (voir
 * `lib/rapports.ts`) sans rien demander au backend.
 *
 * **Le 204 est un état vide, pas une erreur** (RG-REP-02) : une période sans activité affiche une
 * explication et une sortie, jamais un bandeau rouge. L'export est alors refusé, faute de contenu.
 */
export function FormulaireRapport() {
  const t = useTranslations("rapports");
  const td = useTranslations("domaine");
  const [periode, setPeriode] = useState<PeriodeRapport>(() => periodeParDefaut("MENSUEL"));
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [affiche, setAffiche] = useState(false);
  const [format, setFormat] = useState<"PDF" | "EXCEL" | "CSV">("PDF");
  const [exportEnCours, setExportEnCours] = useState(false);
  const generer = useGenererRapport();

  const valide = periodeValide(periode);

  function changerType(type: (typeof TypeRapport)[number]) {
    // Le type gouverne les bornes proposées : les laisser inchangées afficherait une étiquette
    // « annuel » sur trois jours de données.
    setPeriode(periodeParDefaut(type));
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
        // 204 : le backend n'a rien à produire. Le dire vaut mieux qu'un fichier vide.
        setRapport(null);
        setAffiche(true);
        toast.info(t("exportVide"));
        return;
      }
      telechargerBlob(contenu, nomFichierRapport(periode, format));
      toast.success(t("exportReussi", { format }));
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    } finally {
      setExportEnCours(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded border border-bordure bg-surface p-3">
        <Champ id="rapport-type" label={t("type")} aide={t("typeAide")} className="w-52">
          <Select
            id="rapport-type"
            value={periode.type}
            onChange={(evenement) => changerType(evenement.target.value as (typeof TypeRapport)[number])}
          >
            {TypeRapport.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeRapport.${valeur}` as never)}
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

      {!affiche ? (
        <p className="text-texte-secondaire">{t("avantGeneration")}</p>
      ) : rapport === null ? (
        <EtatVide titre={t("vide")} description={t("videTexte")} />
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-[length:var(--taille-lg)] font-semibold">
            {td(`TypeRapport.${rapport.type}` as never)} ·{" "}
            <span className="font-normal text-texte-secondaire">
              {t("resultatPour", { debut: rapport.dateDebut, fin: rapport.dateFin })}
            </span>
          </h2>

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Ligne libelle={t("nbNouveauxDossiers")} valeur={<span data-nombres>{rapport.nbNouveauxDossiers}</span>} />
            <Ligne libelle={t("nbAudiencesTenues")} valeur={<span data-nombres>{rapport.nbAudiencesTenues}</span>} />
            <Ligne
              libelle={t("nbDemandesFraisDeposees")}
              valeur={<span data-nombres>{rapport.nbDemandesFraisDeposees}</span>}
            />
            <Ligne
              libelle={t("nbDeliberesEnregistres")}
              valeur={<span data-nombres>{rapport.nbDeliberesEnregistres}</span>}
            />
            <Ligne
              libelle={t("tauxSuccesRecouvrement")}
              valeur={<Pourcentage valeur={rapport.tauxSuccesRecouvrement} />}
            />
            <Ligne libelle={t("provisionsReprises")} valeur={<MontantFcfa valeur={rapport.provisionsReprises} />} />
          </dl>
        </section>
      )}
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-bordure bg-surface p-4">
      <dt className="text-[length:var(--taille-sm)] text-texte-secondaire">{libelle}</dt>
      <dd className="text-[length:var(--taille-xl)] font-semibold tracking-tight">{valeur}</dd>
    </div>
  );
}
