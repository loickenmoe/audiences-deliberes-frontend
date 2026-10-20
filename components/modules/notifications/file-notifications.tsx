"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, TableDonnees } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { useMesNotifications, useTraiterAlerte } from "@/hooks/useAlertes";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import {
  TON_STATUT_ALERTE,
  VUES_NOTIFICATIONS,
  estATraiter,
  nettoyerDeclencheur,
  type CleVueNotifications,
} from "@/lib/alertes";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import { TypeAlerte } from "@/types/enums";
import { useCanalAlertes } from "@/providers/alertes.provider";
import { cn } from "@/lib/utils";
import type { Alerte } from "@/types/domaine";

const VUES: CleVueNotifications[] = ["aTraiter", "traitees", "toutes"];

const VIDE: Record<CleVueNotifications, string> = {
  aTraiter: "vide",
  traitees: "videTraitees",
  toutes: "videToutes",
};

/**
 * Screen 03 - my notifications.
 *
 * The list belongs to the recipient: the backend returns only their alerts and only lets them mark
 * them as handled (403 otherwise). It opens on unread ones.
 * The real-time channel status is shown so the user knows whether the feed is live or refreshed
 * every 30 seconds. Either way the list is complete: the backend stores the alert before pushing it.
 */
export function FileNotifications({ roles }: Readonly<{ roles: readonly string[] }>) {
  const t = useTranslations("notifications");
  const td = useTranslations("domaine");
  const { connecte } = useCanalAlertes();
  const { filtres, page, taille, definirTaille, definirFiltre, definirPage } = useFiltresUrl({
    vue: "aTraiter",
    type: "",
  });
  const vue = (VUES.find((cle) => cle === filtres.vue) ?? "aTraiter") as CleVueNotifications;
  const requete = useMesNotifications(
    VUES_NOTIFICATIONS[vue],
    page,
    taille,
    (filtres.type || undefined) as TypeAlerte | undefined,
  );
  const traiter = useTraiterAlerte();
  // Lawyers cannot access case files: the reference would be a dead link.
  const lienDossier = peut(roles, "consulterDossiers");

  const marquerTraitee = (id: number) => {
    traiter.mutate(id, {
      onSuccess: () => toast.success(t("traiteeSucces")),
      onError: (erreur) => toast.error(messageErreur(erreur)),
    });
  };

  const colonnes = useMemo<ColumnDef<Alerte, unknown>[]>(
    () => [
      {
        id: "type",
        header: t("colonneType"),
        cell: ({ row }) => (
          <span className="font-medium">{td(`TypeAlerte.${row.original.type}` as never)}</span>
        ),
      },
      {
        id: "objet",
        header: t("colonneObjet"),
        cell: ({ row }) => (
          <span className="block max-w-prose">{nettoyerDeclencheur(row.original.declencheur)}</span>
        ),
      },
      {
        id: "dossier",
        header: t("colonneDossier"),
        cell: ({ row }) => {
          const dossierId = row.original.dossierId;
          if (dossierId === null) {
            return <span className="text-texte-tertiaire">{t("horsDossier")}</span>;
          }
          return lienDossier ? (
            <Link
              href={`/dossiers/${dossierId}`}
              className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
            >
              #{dossierId}
            </Link>
          ) : (
            <span className="font-mono text-[length:var(--taille-xs)]">#{dossierId}</span>
          );
        },
      },
      {
        id: "date",
        header: t("colonneDate"),
        cell: ({ row }) => <DateHeureValeur valeur={row.original.dateDeclenchement} />,
      },
      {
        id: "statut",
        header: t("colonneStatut"),
        cell: ({ row }) => (
          <StatutChip ton={TON_STATUT_ALERTE[row.original.statut]}>
            {td(`StatutAlerte.${row.original.statut}` as never)}
          </StatutChip>
        ),
      },
      {
        id: "action",
        header: t("colonneAction"),
        cell: ({ row }) =>
          estATraiter(row.original) ? (
            <Button
              variante="secondaire"
              taille="sm"
              disabled={traiter.isPending}
              onClick={() => marquerTraitee(row.original.id)}
            >
              {t("marquerTraitee")}
            </Button>
          ) : (
            <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
              {row.original.dateTraitement
                ? t("traiteeLe", { date: new Date(row.original.dateTraitement).toLocaleDateString() })
                : null}
            </span>
          ),
      },
    ],
    // `marquerTraitee` is recreated on every render: listing it here would recompute the columns endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, td, lienDossier, traiter.isPending],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("vue")} className="flex w-fit rounded border border-bordure-forte">
          {VUES.map((cle) => (
            <button
              key={cle}
              type="button"
              aria-pressed={cle === vue}
              onClick={() => definirFiltre("vue", cle)}
              className={cn(
                "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
                cle === vue ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
              )}
            >
              {t(`vues.${cle}` as never)}
            </button>
          ))}
        </div>

        {/*
          Filter by alert type: there are seventeen types and hearing reminders fire three times per
          hearing (D-7, D-3, D-1), so appeal deadlines would get lost. Filtering is server-side; doing it
          here would only search the displayed page.
        */}
        <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
          {t("filtreType")}
          <select
            value={filtres.type}
            onChange={(evenement) => definirFiltre("type", evenement.target.value || undefined)}
            className="rounded border border-bordure bg-surface px-2 py-1 text-[length:var(--taille-sm)]"
          >
            <option value="">{t("filtreTousTypes")}</option>
            {TypeAlerte.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeAlerte.${valeur}` as never)}
              </option>
            ))}
          </select>
        </label>

        <p
          data-canal={connecte ? "ouvert" : "repli"}
          className="flex items-center gap-2 text-[length:var(--taille-xs)] text-texte-secondaire"
        >
          <span
            aria-hidden
            className={cn("size-2 rounded-full", connecte ? "bg-succes" : "bg-attention")}
          />
          {connecte ? t("tempsReelActif") : t("tempsReelInterrompu")}
        </p>
      </div>

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
        titreVide={t(VIDE[vue] as never)}
        descriptionVide={t("videTexte")}
        cleLigne={(alerte) => String(alerte.id)}
      />
    </div>
  );
}
