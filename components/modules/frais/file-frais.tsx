"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, MontantFcfa, TableDonnees } from "@/components/metier";
import { useDemandesFrais } from "@/hooks/useFrais";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { TON_STATUT_FRAIS, aDonneSonAccord, vuesFrais, type CleVueFrais } from "@/lib/frais";
import { CompteAvocatNonRattache } from "@/components/modules/portail/compte-non-rattache";
import { estCompteAvocatNonRattache } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { DemandeFrais } from "@/types/domaine";

/** Empty-view messages, from UC-INT-02/03/04 (alt. 1-a). */
const VIDE: Record<CleVueFrais, string> = {
  aControler: "videControle",
  opportunite: "videControle",
  aPayer: "videPaiement",
  conjointe: "videConjointe",
  toutes: "vide",
};

/**
 * Screen 28 - expense request queue. It opens on what awaits the user (see `vuesFrais`): compliance
 * then payment for the Assistant, opportunity then joint approval for the DJA, joint approval for
 * the DJ. The view lives in the URL, so a shared link opens the same queue.
 */
export function FileFrais({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("frais");
  const td = useTranslations("domaine");
  const vues = useMemo(() => vuesFrais(roles), [roles]);
  const defauts = useMemo(() => ({ vue: vues[0].cle as string }), [vues]);
  const { filtres, page, taille, definirTaille, definirFiltre, definirPage } = useFiltresUrl(defauts);
  const vue = vues.find((v) => v.cle === filtres.vue) ?? vues[0];
  const requete = useDemandesFrais(vue.statut, page, taille);
  // Lawyers cannot view case files (`ROLE_CONSULTATION`): the reference stays plain text.
  const lienDossier = peut(roles, "consulterDossiers");


  const colonnes = useMemo<ColumnDef<DemandeFrais, unknown>[]>(
    () => [
      {
        id: "facture",
        header: t("colonneFacture"),
        cell: ({ row }) => (
          <Link href={`/frais/${row.original.id}`} className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4">
            {row.original.referenceFacture}
          </Link>
        ),
      },
      {
        id: "dossier",
        header: t("colonneDossier"),
        cell: ({ row }) =>
          lienDossier ? (
            <Link href={`/dossiers/${row.original.dossierId}`} className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4">
              {row.original.referenceDossier}
            </Link>
          ) : (
            <span className="font-mono text-[length:var(--taille-xs)]">{row.original.referenceDossier}</span>
          ),
      },
      { accessorKey: "avocatNom", header: t("colonneAvocat") },
      {
        id: "montant",
        header: t("colonneMontant"),
        cell: ({ row }) => <MontantFcfa valeur={row.original.montant} />,
      },
      {
        id: "depot",
        header: t("colonneDepot"),
        cell: ({ row }) => <DateHeureValeur valeur={row.original.createdAt} />,
      },
      {
        id: "statut",
        header: t("colonneStatut"),
        cell: ({ row }) => {
          const demande = row.original;
          const enCours = demande.statutCircuit === "CONFORMITE" || demande.statutCircuit === "OPPORTUNITE";
          return (
            <span className="flex flex-col items-start gap-1">
              <StatutChip ton={TON_STATUT_FRAIS[demande.statutCircuit]}>
                {td(`StatutCircuitFrais.${demande.statutCircuit}` as never)}
              </StatutChip>
              {enCours && demande.validationConjointeRequise ? (
                <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("conjointeRequise")}</span>
              ) : null}
              {demande.statutCircuit === "OPPORTUNITE" && aDonneSonAccord(demande, roles) ? (
                <span className="text-[length:var(--taille-xs)]">{t("votreAccordDonne")}</span>
              ) : null}
            </span>
          );
        },
      },
    ],
    [t, td, lienDossier, roles],
  );

  /*
   * A lawyer whose account is not linked to the directory has no requests: this is not a loading
   * failure. The check comes after the hooks, since an early return before them would change the
   * hook order between renders.
   */
  if (estCompteAvocatNonRattache(requete.error)) return <CompteAvocatNonRattache />;

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
        cleLigne={(demande) => String(demande.id)}
      />
    </div>
  );
}
