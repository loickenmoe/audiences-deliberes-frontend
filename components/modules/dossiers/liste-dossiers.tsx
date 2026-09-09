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
import { CategorieDossier } from "@/types/enums";

const DEFAUTS = { reference: "", juridiction: "", categorie: "", nature: "", mesDossiers: "" };

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
  const { filtres, page, definirFiltre, definirPage, effacer, nbFiltresActifs } =
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
    page,
  });

  const colonnes = useMemo<ColumnDef<Dossier, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("colonneReference"),
        // Pas de lien vers la fiche : c'est l'écran 07, livré en F7. Un lien mort serait pire
        // qu'une absence de lien — à rebrancher à l'ouverture de F7.
        cell: ({ row }) => (
          <span className="font-mono text-[length:var(--taille-xs)]">{row.original.reference}</span>
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
        // La dernière étape ouverte est l'étape courante : les étapes arrivent triées par type.
        cell: ({ row }) => {
          const courante = row.original.etapes.at(-1);
          return courante ? (
            <CycleEtape statut={courante.statutCycleVie} type={courante.type} compact />
          ) : (
            "—"
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
            defaultValue={filtres.reference}
            // Au `blur` : écrire dans l'URL à chaque frappe produirait une requête par caractère.
            onBlur={(evenement) => definirFiltre("reference", evenement.target.value || undefined)}
          />
        </Champ>

        <Champ id="filtre-juridiction" label={t("rechercheJuridiction")} className="w-44">
          <Input
            id="filtre-juridiction"
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
        onReessayer={() => void requete.refetch()}
        titreVide={t("aucunDossier")}
        descriptionVide={t("aucunDossierTexte")}
        cleLigne={(dossier) => String(dossier.id)}
      />
    </div>
  );
}
