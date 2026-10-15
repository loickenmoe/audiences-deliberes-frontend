import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Primitives de tableau.
 *
 * Le conteneur porte `overflow-x-auto` : une table large défile **dans son propre cadre**, jamais en
 * poussant la page entière de côté. Les chiffres s'alignent (`tabular-nums` via `globals.css`).
 *
 * **`tabIndex={0}` n'est pas décoratif.** Une région qui défile doit être atteignable au clavier
 * (WCAG 2.1.1, règle axe `scrollable-region-focusable`) : sans cela, un utilisateur sans souris ne
 * peut pas faire défiler le tableau, et les colonnes de droite lui sont **inaccessibles**. Le
 * conteneur reçoit donc le focus, et les flèches le font défiler. Rien d'autre n'est ajouté : c'est
 * le `<table>` qu'il contient qui porte la sémantique, et un rôle de plus sur le cadre ne ferait
 * qu'annoncer un groupe sans nom.
 */
export function TableWrapper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("overflow-x-auto rounded-lg border border-bordure bg-surface", className)}
      tabIndex={0}
      {...props}
    />
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse", className)} {...props} />;
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-surface-attenuee", className)} {...props} />;
}

export function Tbody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-bordure last:border-b-0", className)} {...props} />
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-left font-mono text-[length:var(--taille-2xs)] font-medium uppercase tracking-[0.1em] text-texte-tertiaire",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-2.5 align-top text-[length:var(--taille-sm)]", className)}
      {...props}
    />
  );
}
