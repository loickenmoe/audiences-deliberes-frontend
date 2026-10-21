import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Table primitives.
 *
 * The container has `overflow-x-auto`: a wide table scrolls **within its own frame**, never pushing
 * the whole page sideways. Numbers align (`tabular-nums` via `globals.css`).
 *
 * **`tabIndex={0}` is required.** A scrollable region must be keyboard-reachable (WCAG 2.1.1, axe rule
 * `scrollable-region-focusable`), otherwise keyboard users cannot reach the right-hand columns.
 * Nothing else is added: the inner `<table>` carries the semantics, and an extra role on the frame
 * would only announce an unnamed group.
 */
export function TableWrapper({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn("overflow-x-auto rounded-lg border border-bordure bg-surface", className)}
      tabIndex={0} // NOSONAR - a scrollable region must be keyboard-reachable (WCAG 2.1.1, see above)
      {...props}
    />
  );
}

/**
 * Generic primitive: the header row comes from the caller (`Thead` + `Th`), which every table of the
 * application provides. typescript:S5256 cannot see through `children` (false positive).
 */
export function Table({ className, ...props }: Readonly<HTMLAttributes<HTMLTableElement>>) {
  return <table className={cn("w-full border-collapse", className)} {...props} />; // NOSONAR
}

export function Thead({ className, ...props }: Readonly<HTMLAttributes<HTMLTableSectionElement>>) {
  return <thead className={cn("bg-surface-attenuee", className)} {...props} />;
}

export function Tbody(props: Readonly<HTMLAttributes<HTMLTableSectionElement>>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...props }: Readonly<HTMLAttributes<HTMLTableRowElement>>) {
  return (
    <tr className={cn("border-b border-bordure last:border-b-0", className)} {...props} />
  );
}

export function Th({ className, ...props }: Readonly<ThHTMLAttributes<HTMLTableCellElement>>) {
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

export function Td({ className, ...props }: Readonly<TdHTMLAttributes<HTMLTableCellElement>>) {
  return (
    <td
      className={cn("px-4 py-2.5 align-top text-[length:var(--taille-sm)]", className)}
      {...props}
    />
  );
}
