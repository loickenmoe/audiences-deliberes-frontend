import type { TonStatut } from "@/components/global/statut-chip";
import type { Alerte, ConfigurationSysteme } from "@/types/domaine";
import type { StatutAlerte } from "@/types/enums";

export const TON_STATUT_ALERTE: Record<StatutAlerte, TonStatut> = {
  DECLENCHEE: "attention",
  TRAITEE: "succes",
};

/**
 * Le backend préfixe certains déclencheurs d'un **marqueur anti-doublon** technique —
 * `[delibereId:12] `, `[audienceId:5;J-7] ` — qui identifie l'événement pour ne pas le signaler
 * deux fois. C'est de la plomberie : elle n'a rien à faire sous les yeux du destinataire.
 */
export function nettoyerDeclencheur(declencheur: string): string {
  return declencheur.replace(/^\[[^\]]*\]\s*/, "").trim();
}

export type CleVueNotifications = "aTraiter" | "traitees" | "toutes";

export const VUES_NOTIFICATIONS: Record<CleVueNotifications, StatutAlerte | null> = {
  aTraiter: "DECLENCHEE",
  traitees: "TRAITEE",
  toutes: null,
};

/** Une notification n'est actionnable que par son destinataire, et seulement tant qu'elle est ouverte. */
export function estATraiter(alerte: Alerte): boolean {
  return alerte.statut === "DECLENCHEE";
}

/**
 * Contrôle de saisie d'un paramètre système, **calqué sur la règle publiée par le backend**
 * (Q-91) : le formulaire refuse tout de suite ce que l'API refuserait de toute façon en 400, sans
 * réécrire les bornes de son côté. Renvoie `null` si la valeur est acceptable, sinon la clé du
 * message à afficher.
 */
export type MotifRefusConfiguration = "obligatoire" | "entier" | "bornes" | "inconnue" | "vide";

export function verifierValeurConfiguration(
  configuration: ConfigurationSysteme,
  valeur: string,
): MotifRefusConfiguration | null {
  const saisie = valeur.trim();
  if (saisie === "") return "obligatoire";

  if (configuration.typeValeur === "ENTIER") {
    if (!/^\d+$/.test(saisie)) return "entier";
    const nombre = Number(saisie);
    const min = configuration.valeurMinimale;
    const max = configuration.valeurMaximale;
    if ((min !== null && nombre < min) || (max !== null && nombre > max)) return "bornes";
    return null;
  }

  if (configuration.typeValeur === "LISTE") {
    const elements = saisie.split(",").map((element) => element.trim().toUpperCase());
    if (elements.some((element) => element === "")) return "vide";
    if (elements.some((element) => !configuration.valeursPossibles.includes(element))) return "inconnue";
    return null;
  }

  // Clé sans règle publiée : le backend n'exige qu'une valeur non vide, on n'en invente pas d'autre.
  return null;
}

/** Bascule un élément d'une liste `A,B,C`, en conservant l'ordre des valeurs acceptées. */
export function basculerElement(valeur: string, element: string, valeursPossibles: string[]): string {
  const courants = new Set(
    valeur
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item !== ""),
  );
  if (courants.has(element)) courants.delete(element);
  else courants.add(element);
  return valeursPossibles.filter((possible) => courants.has(possible)).join(",");
}
