import { cn } from "@/lib/utils";

/**
 * Status chip. Colour **doubles** the label and never replaces it: a status must remain readable
 * without perceiving colour.
 *
 * The semantic colour family is distinct from the brand red - see `globals.css`.
 */
const TONS = {
  neutre: "bg-surface-attenuee text-texte-secondaire border-bordure-forte",
  succes: "bg-succes-fond text-succes border-succes/35",
  attention: "bg-attention-fond text-attention border-attention/35",
  danger: "bg-danger-fond text-danger border-danger/35",
  info: "bg-info-fond text-info border-info/35",
} as const;

export type TonStatut = keyof typeof TONS;

export function StatutChip({
  ton = "neutre",
  children,
  className,
}: Readonly<{
  ton?: TonStatut;
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-[length:var(--taille-2xs)] font-medium uppercase tracking-[0.06em]",
        TONS[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}
