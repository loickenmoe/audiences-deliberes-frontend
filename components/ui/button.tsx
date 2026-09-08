import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Variantes d'action.
 *
 * **`principale` est anthracite, jamais rouge.** Le rouge de marque mesure 4,38:1 sur blanc —
 * insuffisant pour du texte — et, s'il servait de fond d'action, il deviendrait indiscernable du
 * rouge d'erreur dans une interface pleine de rejets et de suppressions.
 */
const VARIANTES = {
  principale:
    "bg-anthracite text-texte-inverse hover:opacity-90 disabled:bg-bordure-forte disabled:text-texte-tertiaire",
  secondaire:
    "border border-bordure-forte bg-surface text-texte hover:bg-surface-attenuee disabled:text-texte-tertiaire",
  discrete: "text-texte-secondaire hover:bg-surface-attenuee hover:text-texte",
  /** Réservée aux suppressions et rejets. Contour plutôt qu'aplat : l'acte doit être délibéré. */
  destructive:
    "border border-danger text-danger hover:bg-danger-fond disabled:border-bordure-forte disabled:text-texte-tertiaire",
} as const;

const TAILLES = {
  sm: "h-8 px-3 text-[length:var(--taille-sm)]",
  md: "h-9 px-4 text-[length:var(--taille-base)]",
  lg: "h-11 px-5 text-[length:var(--taille-base)]",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: keyof typeof VARIANTES;
  taille?: keyof typeof TAILLES;
}

/**
 * Classes d'une action, exposées pour les cas où l'élément doit être un lien : imbriquer un `<a>`
 * dans un `<button>` produit du HTML invalide et casse la navigation clavier.
 */
export function classesBouton({
  variante = "principale",
  taille = "md",
  className,
}: {
  variante?: keyof typeof VARIANTES;
  taille?: keyof typeof TAILLES;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded font-medium transition-[background-color,opacity,color] disabled:cursor-not-allowed",
    VARIANTES[variante],
    TAILLES[taille],
    className,
  );
}

export function Button({
  variante = "principale",
  taille = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={classesBouton({ variante, taille, className })} {...props} />
  );
}
