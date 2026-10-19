import type { TonStatut } from "@/components/global/statut-chip";
import type { Alerte, ConfigurationSysteme } from "@/types/domaine";
import type { StatutAlerte } from "@/types/enums";

export const TON_STATUT_ALERTE: Record<StatutAlerte, TonStatut> = {
  DECLENCHEE: "attention",
  TRAITEE: "succes",
};

/**
 * The backend prefixes some triggers with a technical de-duplication marker (`[delibereId:12] `,
 * `[audienceId:5;J-7] `). It is stripped before display.
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

/** A notification is actionable only by its recipient, and only while it is open. */
export function estATraiter(alerte: Alerte): boolean {
  return alerte.statut === "DECLENCHEE";
}

/**
 * Validates a system setting against the rule published by the backend, so the form rejects
 * upfront what the API would reject with a 400. Returns `null` if valid, else the message key.
 */
export type MotifRefusConfiguration = "obligatoire" | "entier" | "bornes" | "inconnue" | "vide";

export function verifierValeurConfiguration(
  configuration: ConfigurationSysteme,
  valeur: string,
): MotifRefusConfiguration | null {
  const saisie = valeur.trim();
  if (saisie === "") return configuration.listeVideAutorisee ? null : "obligatoire";

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

  // Key without a published rule: the backend only requires a non-empty value.
  return null;
}

/** Toggles an item in an `A,B,C` list, keeping the order of the accepted values. */
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
