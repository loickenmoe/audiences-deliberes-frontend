"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, TableDonnees } from "@/components/metier";
import { useLibellePublication } from "@/components/modules/publications/libelle-publication";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { usePublications } from "@/hooks/usePublications";
import { TON_STATUT_PUBLICATION, vuesPublications, type CleVuePublications } from "@/lib/publications";
import { cn } from "@/lib/utils";
import type { Publication } from "@/types/domaine";
import { cleStatutPublication } from "@/lib/publications";

/** Empty-view message, from UC-INT-10 (alt. 1-a), for the approval queue. */
const VIDE: Record<CleVuePublications, string> = {
  aValider: "videAValider",
  validees: "videValidees",
  rejetees: "videRejetees",
  toutes: "vide",
};

/**
 * Screen 31 - lawyers' publications. The Assistant opens on those awaiting validation, in order of
 * arrival; legal officers, the DJ and the DJA see only validated publications, the only ones they can
 * read (US 5.4). The list shows metadata only: access restrictions apply when opening, not here.
 */
export function FilePublications({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("publications");
  const td = useTranslations("domaine");
  const libelle = useLibellePublication();
  const vues = useMemo(() => vuesPublications(roles), [roles]);
  const defauts = useMemo(() => ({ vue: vues[0].cle as string }), [vues]);
  const { filtres, page, taille, definirTaille, definirFiltre, definirPage } = useFiltresUrl(defauts);
  const vue = vues.find((v) => v.cle === filtres.vue) ?? vues[0];
  const requete = usePublications({ statut: vue.statut, page, size: taille });

  const colonnes = useMemo<ColumnDef<Publication, unknown>[]>(
    () => [
      {
        id: "publication",
        header: t("colonnePublication"),
        cell: ({ row }) => (
          <Link href={`/publications/${row.original.id}`} className="underline underline-offset-4">
            {libelle(row.original)}
          </Link>
        ),
      },
      {
        id: "dossier",
        header: t("colonneDossier"),
        cell: ({ row }) => (
          <Link href={`/dossiers/${row.original.dossierId}`} className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4">
            {row.original.referenceDossier}
          </Link>
        ),
      },
      { accessorKey: "avocatNom", header: t("colonneAvocat") },
      {
        id: "depot",
        header: t("colonneDepot"),
        cell: ({ row }) => <DateHeureValeur valeur={row.original.dateDepot} />,
      },
      {
        id: "statut",
        header: t("colonneStatut"),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <StatutChip ton={TON_STATUT_PUBLICATION[row.original.statutValidation]}>
              {td(cleStatutPublication(row.original.type, row.original.statutValidation) as never)}
            </StatutChip>
            {row.original.restrictionAccesNom ? (
              <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                {t("reservee", { nom: row.original.restrictionAccesNom })}
              </span>
            ) : null}
          </span>
        ),
      },
    ],
    [t, td, libelle],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      {vues.length > 1 ? (
        <div role="group" aria-label={t("vue")} className="flex w-fit rounded border border-bordure-forte">
          {vues.map((v) => (
            <button
              key={v.cle}
              type="button"
              aria-pressed={v.cle === vue.cle}
              onClick={() => definirFiltre("vue", v.cle)}
              className={cn(
                "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
                v.cle === vue.cle ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
              )}
            >
              {t(`vues.${v.cle}` as never)}
            </button>
          ))}
        </div>
      ) : null}

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
        titreVide={t(VIDE[vue.cle] as never)}
        descriptionVide={t("videTexte")}
        cleLigne={(publication) => String(publication.id)}
      />
    </div>
  );
}
