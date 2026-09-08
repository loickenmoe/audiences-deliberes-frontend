"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Les quatre états obligatoires de toute vue de données. Le succès passe par une notification
 * (`sonner`), il n'a pas d'état de page.
 *
 * Règle de rédaction : un état vide dit ce qui manque **et** propose une sortie ; un état d'erreur
 * dit ce qui s'est passé **et** offre de réessayer. Jamais d'excuse, jamais de « oups ».
 */

export function EtatVide({
  titre,
  description,
  action,
  className,
}: {
  titre: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-bordure-forte bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <p className="text-[length:var(--taille-lg)] font-medium">{titre}</p>
      {description ? (
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function EtatErreur({
  titre,
  message,
  action,
  className,
}: {
  titre?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("erreurs");
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-danger bg-danger-fond px-5 py-4",
        className,
      )}
    >
      <p className="font-medium text-danger">{titre ?? t("titreGenerique")}</p>
      {message ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{message}</p>
      ) : null}
      {action}
    </div>
  );
}

/** Ossature générique d'une liste en cours de chargement. */
export function EtatChargement({ lignes = 5, className }: { lignes?: number; className?: string }) {
  const t = useTranslations("commun");
  return (
    <div className={cn("flex flex-col gap-2", className)} role="status" aria-live="polite">
      <span className="sr-only">{t("chargement")}</span>
      {Array.from({ length: lignes }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  );
}
