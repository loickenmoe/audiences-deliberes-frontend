import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * Loading skeleton. Preferred to a spinner: it occupies the space of the expected data, avoiding
 * layout shift when content arrives.
 *
 * The animation is disabled by `prefers-reduced-motion` (see `globals.css`).
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
