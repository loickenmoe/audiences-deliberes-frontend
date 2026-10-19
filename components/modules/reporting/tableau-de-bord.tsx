"use client";

import {
  AlarmClock,
  CalendarDays,
  CircleCheckBig,
  FolderOpen,
  Receipt,
  Scale,
  ThumbsDown,
  Trophy,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { MontantFcfa } from "@/components/metier";
import { DetailIndicateurModale } from "@/components/modules/reporting/detail-indicateur";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { useTableauDeBord } from "@/hooks/useReporting";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { IndicateurTableauDeBord, TableauDeBord } from "@/types/domaine";
import { CategorieDossier } from "@/types/enums";

/**
 * Screen 39 - executive dashboard (FR-REP-02, US 8.5).
 *
 * Nine real-time indicators across all case files: the backend restricts them neither to a period
 * nor to the caller's portfolio. Each carries a sentence stating what it counts.
 * Recovery outcomes are shown as counts (won, lost, mixed), not as a rate: none is inferred, since a
 * mixed deliberation is neither won nor lost. The periodic report (screen 40) keeps its rate.
 * Restricted to the DJ and the DJA.
 */
export function TableauDeBordExecutif({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("tableauDeBord");
  const tCategorie = useTranslations("domaine.CategorieDossier");
  /*
   * The scope lives in the URL, so a link to a given category's dashboard can be shared and a reload
   * keeps it. Defaults to all categories.
   */
  const { filtres, definirFiltre } = useFiltresUrl({ categorie: "" });
  const perimetre = (CategorieDossier as readonly string[]).includes(filtres.categorie)
    ? (filtres.categorie as CategorieDossier)
    : undefined;
  const requete = useTableauDeBord(perimetre);

  /*
   * The block whose detail is open. Its label travels with it: the modal repeats it as title.
   * Declared before the early returns: a hook after an `if (…) return` would not run in the same
   * order between renders, which React forbids.
   */
  const [ouvert, setOuvert] = useState<{
    indicateur: IndicateurTableauDeBord;
    libelle: string;
  } | null>(null);

  if (requete.isLoading) return <EtatChargement lignes={6} />;
  if (requete.error) {
    return (
      <EtatErreur
        message={messageErreur(requete.error)}
        action={
          <Button variante="secondaire" onClick={() => void requete.refetch()}>
            {t("titre")}
          </Button>
        }
      />
    );
  }

  const donnees = requete.data;
  if (!donnees) return null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
          <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {/* The scope drives the nine indicators and their detail, so it is placed in the header, before the figures. */}
          <Champ id="tdb-perimetre" label={t("perimetre")} aide={t("perimetreAide")} className="w-64">
            <Select
              id="tdb-perimetre"
              value={filtres.categorie}
              onChange={(evenement) => definirFiltre("categorie", evenement.target.value)}
            >
              <option value="">{t("perimetreToutes")}</option>
              {CategorieDossier.map((categorie) => (
                <option key={categorie} value={categorie}>
                  {tCategorie(categorie)}
                </option>
              ))}
            </Select>
          </Champ>
          {/* The DJ and the DJA have `ROLE_JURISTE`: the report is accessible to them. */}
          {peut(roles, "genererRapport") ? (
            <Link
              href="/rapports"
              className="pb-2 text-[length:var(--taille-sm)] underline underline-offset-4 hover:text-marque-texte"
            >
              {t("versRapports")}
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Indicateur
          icone={<FolderOpen size={18} aria-hidden />}
          libelle={t("nbDossiersActifs")}
          aide={t("nbDossiersActifsAide")}
          indicateur="DOSSIERS_ACTIFS"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbDossiersActifs} />}
        />
        {/* Placed right after active case files: it complements them and is read with them. */}
        <Indicateur
          icone={<CircleCheckBig size={18} aria-hidden />}
          libelle={t("nbAffairesVidees")}
          aide={t("nbAffairesVideesAide")}
          indicateur="AFFAIRES_VIDEES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbAffairesVidees} />}
        />
        <Indicateur
          icone={<CalendarDays size={18} aria-hidden />}
          libelle={t("nbAudiencesPlanifiees")}
          aide={t("nbAudiencesPlanifieesAide")}
          indicateur="AUDIENCES_PLANIFIEES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbAudiencesPlanifiees} />}
        />
        <Indicateur
          icone={<Receipt size={18} aria-hidden />}
          libelle={t("nbDemandesFraisEnAttente")}
          aide={t("nbDemandesFraisEnAttenteAide")}
          indicateur="FRAIS_EN_ATTENTE"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbDemandesFraisEnAttente} />}
        />
        <Indicateur
          icone={<AlarmClock size={18} aria-hidden />}
          libelle={t("nbProrogationsAlerte")}
          aide={t("nbProrogationsAlerteAide")}
          indicateur="PROROGATIONS_ALERTE"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbProrogationsAlerte} />}
          alerte={donnees.nbProrogationsAlerte > 0}
        />
        <Indicateur
          icone={<Trophy size={18} aria-hidden />}
          libelle={t("nbLitigesGagnes")}
          aide={t("nbLitigesGagnesAide")}
          indicateur="LITIGES_GAGNES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbLitigesGagnes} />}
        />
        <Indicateur
          icone={<ThumbsDown size={18} aria-hidden />}
          libelle={t("nbLitigesPerdus")}
          aide={t("nbLitigesPerdusAide")}
          indicateur="LITIGES_PERDUS"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbLitigesPerdus} />}
        />
        <Indicateur
          icone={<Scale size={18} aria-hidden />}
          libelle={t("nbLitigesMixtes")}
          aide={t("nbLitigesMixtesAide")}
          indicateur="DECISIONS_MIXTES"
          onDetail={setOuvert}
          valeur={<Nombre valeur={donnees.nbLitigesMixtes} />}
        />
        <Indicateur
          icone={<Wallet size={18} aria-hidden />}
          libelle={t("provisionsReprises")}
          aide={t("provisionsReprisesAide")}
          indicateur="PROVISIONS_REPRISES"
          onDetail={setOuvert}
          valeur={<MontantFcfa valeur={donnees.provisionsReprises} />}
        />
      </dl>

      <DetailIndicateurModale
        indicateur={ouvert?.indicateur ?? null}
        libelle={ouvert?.libelle ?? ""}
        categorie={perimetre}
        onFermeture={() => setOuvert(null)}
      />
    </div>
  );
}

/** Counters are integers: displaying them with `data-nombres` aligns the columns. */
function Nombre({ valeur }: { valeur: number }) {
  return <span data-nombres>{valeur}</span>;
}

function Indicateur({
  icone,
  libelle,
  aide,
  valeur,
  alerte = false,
  indicateur,
  onDetail,
}: {
  icone: ReactNode;
  libelle: string;
  aide: string;
  valeur: ReactNode;
  /** A non-zero alert counter is highlighted; the color reinforces the number, it does not replace it. */
  alerte?: boolean;
  /** When set, the block opens the detail of what it counts. */
  indicateur?: IndicateurTableauDeBord;
  onDetail?: (choix: { indicateur: IndicateurTableauDeBord; libelle: string }) => void;
}) {
  const tDetail = useTranslations("detailIndicateur");
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-bordure bg-surface p-4">
      <dt className="flex items-center gap-2 text-[length:var(--taille-sm)] font-medium text-texte-secondaire">
        <span className={alerte ? "text-attention" : "text-texte-tertiaire"}>{icone}</span>
        {libelle}
      </dt>
      <dd className="flex flex-col gap-1">
        <span
          className={`text-[length:var(--taille-2xl)] font-semibold tracking-tight ${alerte ? "text-attention" : ""}`}
        >
          {valeur}
        </span>
        <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{aide}</span>
        {/*
          A named button rather than a clickable block: a clickable `<div>` is neither keyboard-reachable
          nor announced as an action. The accessible name includes the indicator, since nine "Voir le
          détail" buttons would be indistinguishable.
        */}
        {indicateur && onDetail ? (
          <button
            type="button"
            className="self-start text-[length:var(--taille-xs)] text-lien underline underline-offset-4 hover:no-underline"
            onClick={() => onDetail({ indicateur, libelle })}
            aria-label={tDetail("voirDetailDe", { libelle })}
          >
            {tDetail("voirDetail")}
          </button>
        ) : null}
      </dd>
    </div>
  );
}

export type { TableauDeBord };
