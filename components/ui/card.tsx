import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Container surface, following the GFA convention (Afriland application in production): white card
 * on a light grey background, subtle shadow, slightly rounded corners.
 *
 * A card marks a distinct object: do not wrap every block in one, or it flattens the hierarchy it
 * is meant to create.
 */
export function Card({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
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

export function CardHeader({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn("flex flex-col gap-1 border-b border-bordure p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: Readonly<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h2
      className={cn("text-[length:var(--taille-xl)] font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: Readonly<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p
      className={cn("text-[length:var(--taille-sm)] text-texte-secondaire", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn("p-5", className)} {...props} />;
}
