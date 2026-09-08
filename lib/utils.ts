import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind en résolvant les conflits (convention shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant en francs CFA. Les montants du domaine sont importants (seuil par défaut :
 * 50 000 000 FCFA) et toujours entiers : aucune décimale n'est affichée.
 */
export function formaterFcfa(montant: number | null | undefined): string {
  if (montant === null || montant === undefined || Number.isNaN(montant)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(montant);
}

/** Formate une date ISO `YYYY-MM-DD` renvoyée par le backend. */
export function formaterDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

/** Formate un horodatage ISO, pour l'historique et les journaux d'action. */
export function formaterDateHeure(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(date);
}
