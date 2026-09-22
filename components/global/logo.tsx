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
 *
 * `decoratif` — vide le texte alternatif. À n'employer que lorsque le logo est **à l'intérieur
 * d'un élément qui porte déjà son propre libellé**, typiquement le lien de retour à l'accueil : sans
 * cela, le nom accessible du lien serait « Afriland First Bank », qui dit à qui appartient le logo
 * et non où le lien mène. Partout ailleurs — connexion, page introuvable, accès refusé — le texte
 * alternatif reste indispensable : le logo y est la seule identification de l'émetteur.
 */
export function Logo({
  variante = "lockup",
  hauteur = 32,
  decoratif = false,
  className,
}: {
  variante?: "lockup" | "symbole";
  hauteur?: number;
  decoratif?: boolean;
  className?: string;
}) {
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
