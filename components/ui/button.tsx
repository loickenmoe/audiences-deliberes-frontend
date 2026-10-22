import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Action variants.
 *
 * **`principale` is charcoal, never red.** The brand red measures 4.38:1 on white (insufficient for
 * text), and as an action background it would be indistinguishable from the error red in an
 * interface full of rejections and deletions.
 */
const VARIANTES = {
  principale:
    "bg-anthracite text-texte-inverse hover:opacity-90 disabled:bg-bordure-forte disabled:text-texte-tertiaire",
  secondaire:
    "border border-bordure-forte bg-surface text-texte hover:bg-surface-attenuee disabled:text-texte-tertiaire",
  discrete: "text-texte-secondaire hover:bg-surface-attenuee hover:text-texte",
  /** Reserved for deletions and rejections. Outline rather than fill: the act must be deliberate. */
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
 * Classes of an action, exposed for cases where the element must be a link: nesting an `<a>` inside
 * a `<button>` produces invalid HTML and breaks keyboard navigation.
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
}: Readonly<ButtonProps>) {
  return (
    <button type={type} className={classesBouton({ variante, taille, className })} {...props} />
  );
}
