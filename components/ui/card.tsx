import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Surface portante. Convention relevée sur GFA, application Afriland en production : carte blanche
 * posée sur un fond gris clair, ombre discrète, angles peu marqués.
 *
 * Une carte signale un objet distinct — ne pas en envelopper chaque bloc, sous peine d'aplatir la
 * hiérarchie qu'elle est censée créer.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-bordure bg-surface shadow-[var(--ombre-carte)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 border-b border-bordure p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-[length:var(--taille-xl)] font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-[length:var(--taille-sm)] text-texte-secondaire", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
