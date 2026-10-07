"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

import { BarreFiltres, CycleEtape, MontantFcfa, TableDonnees } from "@/components/metier";
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
 * Écran 05 — recherche de dossiers.
 *
 * Les filtres `reference` et « mes dossiers » n'existaient pas côté backend : ils ont été ajoutés
 * en M16 (QF-07). Sans eux, l'écran n'aurait offert que nature, catégorie et juridiction — trois
 * filtres qui ne permettent pas de retrouver *un* dossier précis. Et les rejouer côté navigateur
 * aurait menti : sur une liste paginée, la recherche n'aurait porté que sur la page affichée.
 */
export function ListeDossiers({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("dossiers");
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
        // La référence est le point d'entrée naturel vers la fiche (écran 07).
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
        // Le backend renvoie `clientNom`, mais le laisse à `null` sur certaines projections.
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
         * L'étape la plus avancée — les étapes arrivent triées par type — **et** le pourvoi CCJA
         * s'il existe, car les deux cassations sont concurrentes : un dossier peut être devant la
         * Cour Suprême et devant la CCJA en même temps, l'une en délibéré et l'autre clôturée.
         * N'en montrer qu'une reviendrait à cacher la moitié de la procédure, et laquelle serait
         * cachée dépendrait d'un ordre de tri.
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
          // Un lien, pas un bouton : la création est une navigation vers l'écran 06, et doit rester
          // ouvrable dans un nouvel onglet.
          <Link href="/dossiers/nouveau" className={classesBouton()}>
            <Plus size={15} aria-hidden />
            {t("nouveauDossier")}
          </Link>
        ) : null}
      </header>

      <BarreFiltres nbFiltresActifs={nbFiltresActifs} onEffacer={effacer}>
        <Champ id="filtre-reference" label={t("rechercheReference")} className="w-44">
          <Input
            id="filtre-reference"
            placeholder={t("phFiltreReference")}
            key={filtres.reference}
            defaultValue={filtres.reference}
            // Au `blur` : écrire dans l'URL à chaque frappe produirait une requête par caractère.
            onBlur={(evenement) => definirFiltre("reference", evenement.target.value || undefined)}
          />
        </Champ>

        <Champ id="filtre-juridiction" label={t("rechercheJuridiction")} className="w-44">
          <Input
            id="filtre-juridiction"
            placeholder={t("phFiltreJuridiction")}
            key={filtres.juridiction}
            defaultValue={filtres.juridiction}
            onBlur={(evenement) => definirFiltre("juridiction", evenement.target.value || undefined)}
          />
        </Champ>

        <Champ id="filtre-categorie" label={t("filtreCategorie")} className="w-52">
          <Select
            id="filtre-categorie"
            value={filtres.categorie}
            onChange={(evenement) => {
              // Changer de catégorie invalide la nature choisie : elle appartenait à l'autre.
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
              // Le backend filtre sur le **libellé**, pas sur le code.
              <option key={nature.id} value={nature.libelle}>
                {nature.libelle}
              </option>
            ))}
          </Select>
        </Champ>

        {/*
          Observation métier du 2026-09-25 — « trier les dossiers en fonction de leur étape et
          pendant une période donnée ». Les deux critères d'étape portent sur une **même** étape :
          choisir « Appel » et « En cours » donne les appels en cours, et non les dossiers ayant un
          appel par ailleurs et autre chose en cours.
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
          La période porte sur les **audiences**, non sur l'ouverture du dossier : la question du
          métier est « quels dossiers sont passés devant un juge entre ces deux dates ». Les
          audiences annulées en sont exclues côté serveur — elles ne se sont pas tenues.
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
          Q-101 — filtrer les dossiers sensibles, demandé par le porteur du projet. Le statut de
          validation ne relève pas du confort : `EN_ATTENTE` donne au DJ et à la DJA la file des
          sensibilités qui les attendent, que rien n'exposait jusqu'ici.
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
