import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Ossature de chargement. Préférée à un indicateur tournant : elle occupe la place de la donnée
 * attendue, ce qui évite le saut de mise en page à l'arrivée du contenu.
 *
 * L'animation est neutralisée par `prefers-reduced-motion` (cf. `globals.css`).
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded bg-surface-attenuee [animation:pulsation_1.6s_ease-in-out_infinite]",
        className,
      )}
      {...props}
    />
  );
}
