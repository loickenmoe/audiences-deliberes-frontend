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
 * Écran 03 — mes notifications.
 *
 * La liste appartient au destinataire : le backend ne renvoie que ses alertes et n'accepte que de
 * lui qu'elles soient marquées traitées (403 sinon). Elle s'ouvre donc sur les non lues.
 *
 * L'état du canal temps réel est affiché : c'est la seule façon pour l'utilisateur de savoir s'il
 * regarde un flux vivant ou une liste rafraîchie toutes les 30 secondes. Dans les deux cas la
 * liste est complète — le backend enregistre l'alerte avant de tenter de la pousser.
 */
export function FileNotifications({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("notifications");
  const td = useTranslations("domaine");
  const { connecte } = useCanalAlertes();
  const { filtres, page, definirFiltre, definirPage } = useFiltresUrl({ vue: "aTraiter" });
  const vue = (VUES.find((cle) => cle === filtres.vue) ?? "aTraiter") as CleVueNotifications;
  const requete = useMesNotifications(VUES_NOTIFICATIONS[vue], page);
  const traiter = useTraiterAlerte();
  // L'avocat n'accède pas aux dossiers : la référence resterait un lien mort.
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
    // `marquerTraitee` est recréée à chaque rendu : la lister ici recalculerait les colonnes en boucle.
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
        onReessayer={() => void requete.refetch()}
        titreVide={t(VIDE[vue] as never)}
        descriptionVide={t("videTexte")}
        cleLigne={(alerte) => String(alerte.id)}
      />
    </div>
  );
}
