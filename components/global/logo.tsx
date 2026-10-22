import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Official Afriland First Bank logo (original bank files, unmodified).
 *
 * `lockup` - horizontal signature (284.7 x 57.6), the default: headers, login page.
 * `symbole` - mark only (71.7 x 57.6). **It has a red solid area on its left edge**: use it
 * full-bleed, never cut out on a light background where that area would look accidental.
 *
 * `decoratif` - empties the alt text. Use only when the logo sits **inside an element that already
 * has its own label** (e.g. the home link), otherwise that link's accessible name would be the bank's
 * name instead of its destination. Everywhere else the alt text is required: the logo is the only
 * identification of the issuer.
 */
export function Logo({
  variante = "lockup",
  hauteur = 32,
  decoratif = false,
  className,
}: Readonly<{
  variante?: "lockup" | "symbole";
  hauteur?: number;
  decoratif?: boolean;
  className?: string;
}>) {
  const lockup = variante === "lockup";
  const ratio = lockup ? 284.7 / 57.6 : 71.7 / 57.6;

  return (
    <Image
      src={lockup ? "/brand/logo-afriland.svg" : "/brand/symbole-afriland.svg"}
      alt={decoratif ? "" : "Afriland First Bank"}
      width={Math.round(hauteur * ratio)}
      height={hauteur}
      priority
      className={cn("h-auto w-auto", className)}
      style={{ height: hauteur }}
    />
  );
}
