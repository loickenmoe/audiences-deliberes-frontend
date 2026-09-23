import type { ConfigurationSysteme, LigneCanalNotification } from "@/types/domaine";

/**
 * Réglages des notifications externes (backend Q-118).
 *
 * Deux publics, chacun avec son interrupteur de canaux et sa grille :
 * - les utilisateurs internes : Outlook et Teams, interrupteur `CANAUX_NOTIFICATION_DEFAUT` ;
 * - les prestataires : courriel personnel, SMS et WhatsApp, interrupteur
 *   `CANAUX_NOTIFICATION_PRESTATAIRES`.
 *
 * Une colonne de la grille est une clé de configuration : la liste des événements envoyés sur ce
 * canal. Les lignes viennent des valeurs acceptées publiées par le backend ; rien n'est redéclaré ici.
 */
export interface SectionGrille {
  identifiant: "internes" | "prestataires";
  /** Clé qui active ou coupe les canaux de ce public. */
  cleCanaux: string;
  colonnes: { cle: string; canal: string }[];
}

export const SECTIONS_GRILLE: SectionGrille[] = [
  {
    identifiant: "internes",
    cleCanaux: "CANAUX_NOTIFICATION_DEFAUT",
    colonnes: [
      { cle: "GRILLE_NOTIFICATION_OUTLOOK", canal: "OUTLOOK" },
      { cle: "GRILLE_NOTIFICATION_TEAMS", canal: "TEAMS" },
    ],
  },
  {
    identifiant: "prestataires",
    cleCanaux: "CANAUX_NOTIFICATION_PRESTATAIRES",
    colonnes: [
      { cle: "GRILLE_NOTIFICATION_COURRIEL_PERSONNEL", canal: "COURRIEL_PERSONNEL" },
      { cle: "GRILLE_NOTIFICATION_SMS", canal: "SMS" },
      { cle: "GRILLE_NOTIFICATION_WHATSAPP", canal: "WHATSAPP" },
    ],
  },
];

/** Les colonnes de grille s'affichent dans le tableau, pas dans la liste générique des paramètres. */
export function estCleDeGrille(cle: string): boolean {
  return cle.startsWith("GRILLE_NOTIFICATION_");
}

/** Clés dont les valeurs sont des canaux : leurs cases portent un libellé traduit, pas un code. */
export const CLES_CANAUX: Record<string, "CanalAlerte" | "CanalPrestataire"> = {
  CANAUX_NOTIFICATION_DEFAUT: "CanalAlerte",
  CANAUX_NOTIFICATION_PRESTATAIRES: "CanalPrestataire",
};

/** Éléments d'une liste `A,B,C`, normalisés ; une liste vide donne un tableau vide. */
export function lireListe(valeur: string): string[] {
  return valeur
    .split(",")
    .map((element) => element.trim().toUpperCase())
    .filter((element) => element !== "");
}

/** État de saisie d'une section : pour chaque clé de colonne, les événements cochés. */
export type SaisieGrille = Record<string, string[]>;

export function saisieInitiale(section: SectionGrille, configurations: ConfigurationSysteme[]): SaisieGrille {
  return Object.fromEntries(
    section.colonnes.map(({ cle }) => [cle, lireListe(trouver(configurations, cle)?.valeur ?? "")]),
  );
}

/** Coche ou décoche un événement dans une colonne, en gardant l'ordre publié par le backend. */
export function basculerCase(
  saisie: SaisieGrille,
  cle: string,
  evenement: string,
  ordre: string[],
): SaisieGrille {
  const courants = new Set(saisie[cle] ?? []);
  if (courants.has(evenement)) courants.delete(evenement);
  else courants.add(evenement);
  return { ...saisie, [cle]: ordre.filter((element) => courants.has(element)) };
}

/**
 * Colonnes modifiées, avec la valeur à envoyer. Seules celles-ci partent : chaque clé enregistrée
 * laisse une trace dans l'audit, et une colonne inchangée n'a rien à y écrire.
 */
export function colonnesModifiees(
  saisie: SaisieGrille,
  configurations: ConfigurationSysteme[],
): { cle: string; valeur: string }[] {
  return Object.entries(saisie)
    .map(([cle, elements]) => ({ cle, valeur: elements.join(",") }))
    .filter(({ cle, valeur }) => valeur !== lireListe(trouver(configurations, cle)?.valeur ?? "").join(","));
}

/** Un canal est actif quand l'interrupteur de son public le contient. */
export function canalActif(section: SectionGrille, canal: string, configurations: ConfigurationSysteme[]): boolean {
  return lireListe(trouver(configurations, section.cleCanaux)?.valeur ?? "").includes(canal);
}

export function trouver(configurations: ConfigurationSysteme[], cle: string): ConfigurationSysteme | undefined {
  return configurations.find((configuration) => configuration.cle === cle);
}

/** Les trente derniers jours, bornes incluses, au format ISO attendu par le backend. */
export function fenetreParDefaut(): { debut: string; fin: string } {
  const aujourdHui = new Date();
  const ilYATrenteJours = new Date(aujourdHui.getTime() - 29 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { debut: iso(ilYATrenteJours), fin: iso(aujourdHui) };
}

/**
 * Part de ce qui est parti ou en passe de partir, en pourcentage à une décimale.
 *
 * Les lignes sans coordonnée sont **exclues du calcul** : elles signalent une fiche à compléter, pas
 * un canal défaillant. Un canal sans aucun envoi ne rend aucun taux — afficher « 0 % » laisserait
 * croire à un échec là où il ne s'est rien passé.
 */
export function tauxAboutissement(ligne: LigneCanalNotification): number | null {
  const total =
    ligne.enAttente + ligne.remises + ligne.confirmees + ligne.echecs + ligne.sansRetour + ligne.nonJoignables;
  const denominateur = total - ligne.nonJoignables;
  if (denominateur === 0) return null;
  return Math.round(((ligne.confirmees + ligne.remises + ligne.enAttente) / denominateur) * 1000) / 10;
}
