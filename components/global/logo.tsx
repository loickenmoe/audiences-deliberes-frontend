import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Logo officiel Afriland First Bank.
 *
 * `lockup` — signature horizontale (284,7 × 57,6), usage par défaut : en-têtes, page de connexion.
 * `symbole` — marque seule (71,7 × 57,6). **Elle comporte un aplat rouge sur son flanc gauche** :
 * elle s'emploie à fond perdu, jamais détourée sur un fond clair où l'aplat paraîtrait accidentel.
 *
 * Les fichiers sont les originaux fournis par la banque, non retouchés.
 */
export function Logo({
  variante = "lockup",
  hauteur = 32,
  className,
}: {
  variante?: "lockup" | "symbole";
  hauteur?: number;
  className?: string;
}) {
  const lockup = variante === "lockup";
  const ratio = lockup ? 284.7 / 57.6 : 71.7 / 57.6;

  return (
    <Image
      src={lockup ? "/brand/logo-afriland.svg" : "/brand/symbole-afriland.svg"}
      alt="Afriland First Bank"
      width={Math.round(hauteur * ratio)}
      height={hauteur}
      priority
      className={cn("h-auto w-auto", className)}
      style={{ height: hauteur }}
    />
  );
}
