"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

import { BarreFiltres, ChampRecherche, CycleEtape, MontantFcfa, TableDonnees } from "@/components/metier";
import { classesBouton } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { useDossiers } from "@/hooks/useDossiers";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { useNaturesDossier } from "@/hooks/useReferentiels";
import { peut } from "@/lib/rbac";
import type { Dossier } from "@/types/domaine";
import {
  CategorieDossier,
  StatutCycleVie,
  StatutValidation,
  TriDossiers,
  TypeEtape,
} from "@/types/enums";

const DEFAUTS = {
  reference: "",
  juridiction: "",
  categorie: "",
  nature: "",
  mesDossiers: "",
  estSensible: "",
  sensibiliteStatut: "",
  typeEtape: "",
  statutEtape: "",
  dateDebut: "",
  dateFin: "",
  tri: "",
};

/**
 * Screen 05 - case search.
 * Filters run on the backend (including `reference` and "my cases"): filtering in the browser would
 * only search the displayed page of a paginated list.
 */
export function ListeDossiers({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("dossiers");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const { filtres, page, taille, definirTaille, definirFiltre, definirPage, effacer, nbFiltresActifs } =
    useFiltresUrl(DEFAUTS);
  const natures = useNaturesDossier(
    filtres.categorie ? (filtres.categorie as CategorieDossier) : undefined,
  );

  const requete = useDossiers({
    reference: filtres.reference || undefined,
    juridiction: filtres.juridiction || undefined,
    categorie: filtres.categorie ? (filtres.categorie as CategorieDossier) : undefined,
    nature: filtres.nature || undefined,
    mesDossiers: filtres.mesDossiers === "1",
    estSensible: filtres.estSensible === "1" ? true : undefined,
    sensibiliteStatut: (filtres.sensibiliteStatut || undefined) as StatutValidation | undefined,
    typeEtape: (filtres.typeEtape || undefined) as (typeof TypeEtape)[number] | undefined,
    statutEtape: (filtres.statutEtape || undefined) as (typeof StatutCycleVie)[number] | undefined,
    dateDebut: filtres.dateDebut || undefined,
    dateFin: filtres.dateFin || undefined,
    tri: (filtres.tri || undefined) as (typeof TriDossiers)[number] | undefined,
    size: taille,
    page,
  });

  const colonnes = useMemo<ColumnDef<Dossier, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("colonneReference"),
        // The reference is the natural entry point to the case page (screen 07).
        cell: ({ row }) => (
          <Link
            href={`/dossiers/${row.original.id}`}
            className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
          >
            {row.original.reference}
          </Link>
        ),
      },
      {
        accessorKey: "clientNom",
        header: t("colonneClient"),
        // The backend returns `clientNom`, but leaves it `null` on some projections.
        cell: ({ row }) => row.original.clientNom ?? `#${row.original.clientId}`,
      },
      { accessorKey: "nature", header: t("colonneNature") },
      {
        accessorKey: "juridictionSaisie",
        header: t("colonneJuridiction"),
      },
      {
        accessorKey: "risqueEncouru",
        header: t("colonneRisque"),
        cell: ({ row }) => <MontantFcfa valeur={row.original.risqueEncouru} />,
      },
      {
        id: "etape",
        header: t("colonneEtape"),
        /*
         * The most advanced step (steps arrive sorted by type) **and** the CCJA appeal if any: both
         * cassation appeals can run concurrently, and showing only one would hide half of the
         * procedure.
         */
        cell: ({ row }) => {
          const etapes = row.original.etapes;
          const ccja = etapes.find((etape) => etape.type === "RECOURS_2_CCJA");
          const principale = etapes.filter((etape) => etape.type !== "RECOURS_2_CCJA").at(-1);
          const aMontrer = [principale, ccja].filter((etape) => etape !== undefined);
          if (aMontrer.length === 0) return "—";
          return (
            <div className="flex flex-wrap gap-1">
              {aMontrer.map((etape) => (
                <CycleEtape key={etape.id} statut={etape.statutCycleVie} type={etape.type} compact />
              ))}
            </div>
          );
        },
      },
    ],
    [t],
  );

  const peutCreer = peut(roles, "creerDossier");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
            {t("titre")}
          </h1>
          <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        </div>

        {peutCreer ? (
          // A link, not a button: creation navigates to screen 06 and must be openable in a new
          // tab.
          <Link href="/dossiers/nouveau" className={classesBouton()}>
            <Plus size={15} aria-hidden />
            {t("nouveauDossier")}
          </Link>
        ) : null}
      </header>

      <BarreFiltres nbFiltresActifs={nbFiltresActifs} onEffacer={effacer}>
        {/*
          Filter as the user types: `ChampRecherche` debounces input and only propagates after a 300
          ms pause, one request per pause.
        */}
        <ChampRecherche
          id="filtre-reference"
          label={t("rechercheReference")}
          placeholder={t("phFiltreReference")}
          valeur={filtres.reference}
          onChangement={(valeur) => definirFiltre("reference", valeur || undefined)}
          className="w-44"
        />

        <ChampRecherche
          id="filtre-juridiction"
          label={t("rechercheJuridiction")}
          placeholder={t("phFiltreJuridiction")}
          valeur={filtres.juridiction}
          onChangement={(valeur) => definirFiltre("juridiction", valeur || undefined)}
          className="w-44"
        />

        <Champ id="filtre-categorie" label={t("filtreCategorie")} className="w-52">
          <Select
            id="filtre-categorie"
            value={filtres.categorie}
            onChange={(evenement) => {
              // Changing the category invalidates the selected nature, which belonged to the other
              // one.
              definirFiltre("nature", undefined);
              definirFiltre("categorie", evenement.target.value || undefined);
            }}
          >
            <option value="">{t("toutesCategories")}</option>
            {CategorieDossier.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`CategorieDossier.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="filtre-nature" label={t("filtreNature")} className="w-64">
          <Select
            id="filtre-nature"
            value={filtres.nature}
            onChange={(evenement) => definirFiltre("nature", evenement.target.value || undefined)}
          >
            <option value="">{t("toutesNatures")}</option>
            {(natures.data ?? []).map((nature) => (
              // The backend filters on the **label**, not the code.
              <option key={nature.id} value={nature.libelle}>
                {nature.libelle}
              </option>
            ))}
          </Select>
        </Champ>

        {/*
          Both step criteria apply to the **same** step: "Appeal" and "In progress" give appeals in
          progress, not cases with an appeal and something else in progress.
        */}
        <Champ id="filtre-type-etape" label={t("filtreTypeEtape")} className="w-48">
          <Select
            id="filtre-type-etape"
            value={filtres.typeEtape}
            onChange={(evenement) => definirFiltre("typeEtape", evenement.target.value || undefined)}
          >
            <option value="">{t("filtreTous")}</option>
            {TypeEtape.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeEtape.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="filtre-statut-etape" label={t("filtreStatutEtape")} className="w-44">
          <Select
            id="filtre-statut-etape"
            value={filtres.statutEtape}
            onChange={(evenement) => definirFiltre("statutEtape", evenement.target.value || undefined)}
          >
            <option value="">{t("filtreTous")}</option>
            {StatutCycleVie.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`StatutCycleVie.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        {/*
          The period applies to **hearings**, not case opening: which cases went before a judge
          between these two dates. Cancelled hearings are excluded server-side.
        */}
        <Champ id="filtre-date-debut" label={t("filtreAudienceDebut")} className="w-40">
          <Input
            id="filtre-date-debut"
            type="date"
            max={filtres.dateFin || undefined}
            value={filtres.dateDebut}
            onChange={(evenement) => definirFiltre("dateDebut", evenement.target.value || undefined)}
          />
        </Champ>

        <Champ id="filtre-date-fin" label={t("filtreAudienceFin")} className="w-40">
          <Input
            id="filtre-date-fin"
            type="date"
            min={filtres.dateDebut || undefined}
            value={filtres.dateFin}
            onChange={(evenement) => definirFiltre("dateFin", evenement.target.value || undefined)}
          />
        </Champ>

        <Champ id="filtre-tri" label={t("filtreTri")} className="w-48">
          <Select
            id="filtre-tri"
            value={filtres.tri}
            onChange={(evenement) => definirFiltre("tri", evenement.target.value || undefined)}
          >
            {TriDossiers.map((valeur) => (
              <option key={valeur} value={valeur === "RECENT" ? "" : valeur}>
                {td(`TriDossiers.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        {/*
          Filter on sensitive cases. `EN_ATTENTE` gives the DJ and DJA the queue of sensitivity
          proposals awaiting them.
        */}
        <Champ id="filtre-sensibilite" label={t("filtreSensibiliteStatut")} className="w-52">
          <Select
            id="filtre-sensibilite"
            value={filtres.sensibiliteStatut}
            onChange={(evenement) => definirFiltre("sensibiliteStatut", evenement.target.value || undefined)}
          >
            <option value="">{t("filtreTous")}</option>
            {StatutValidation.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`StatutValidation.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        <label className="flex items-center gap-2 self-end pb-2 text-[length:var(--taille-sm)]">
          <input
            type="checkbox"
            checked={filtres.estSensible === "1"}
            onChange={(evenement) =>
              definirFiltre("estSensible", evenement.target.checked ? "1" : undefined)
            }
          />
          {t("filtreSensiblesSeuls")}
        </label>

        <label className="flex items-center gap-2 self-end pb-2 text-[length:var(--taille-sm)]">
          <input
            type="checkbox"
            checked={filtres.mesDossiers === "1"}
            onChange={(evenement) =>
              definirFiltre("mesDossiers", evenement.target.checked ? "1" : undefined)
            }
          />
          {t("mesDossiers")}
        </label>
      </BarreFiltres>

      {/*
        Announces the result count: live filtering changes the list without explicit action, so the
        change must be announced. `sr-only` since the number is already visible in the pagination;
        announced only once the request completes (the table's loading state has its own
        `role="status"`).
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {requete.isLoading ? "" : tm("elements", { nombre: requete.data?.totalElements ?? 0 })}
      </p>

      <TableDonnees
        colonnes={colonnes}
        donnees={requete.data}
        chargement={requete.isLoading}
        erreur={requete.error}
        page={page}
        onChangementPage={definirPage}
        taille={taille}
        onChangementTaille={definirTaille}
        onReessayer={() => void requete.refetch()}
        titreVide={t("aucunDossier")}
        descriptionVide={t("aucunDossierTexte")}
        cleLigne={(dossier) => String(dossier.id)}
      />
    </div>
  );
}
