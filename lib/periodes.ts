/**
 * Raccourcis de période pour l'audit (backend Q-113).
 *
 * **Pourquoi côté client, et pas dans l'API.** Ce sont des commodités de saisie, pas des concepts
 * métier : les exposer au serveur aurait figé six calendriers et interdit la **période libre** —
 * celle que réclame la première inspection qui demande « du 12 mars au 4 juin ». L'API ne connaît
 * qu'un intervalle ; ces fonctions ne font que le pré-remplir.
 *
 * **Chaque raccourci couvre la période *écoulée*, bornes incluses**, et s'arrête aujourd'hui. « Ce
 * mois-ci » ne va pas jusqu'au 31 si l'on est le 12 : une archive qui prétendrait couvrir des jours
 * à venir mentirait sur son contenu, et son empreinte scellerait ce mensonge.
 */

export type RaccourciPeriode = "jour" | "semaine" | "mois" | "trimestre" | "semestre" | "annee";

export const RACCOURCIS_PERIODE: readonly RaccourciPeriode[] = [
  "jour",
  "semaine",
  "mois",
  "trimestre",
  "semestre",
  "annee",
] as const;

export interface Periode {
  debut: string;
  fin: string;
}

/** Format ISO `AAAA-MM-JJ`, celui qu'attend le backend. */
function iso(date: Date): string {
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/**
 * Début de la période courante pour un raccourci donné.
 *
 * Le calcul part du **début de l'unité en cours** — premier jour du mois, du trimestre, du
 * semestre, de l'année — et non d'un décompte de jours en arrière. « Ce trimestre » désigne le
 * trimestre calendaire, pas les quatre-vingt-dix derniers jours : c'est ce qu'un contrôleur entend,
 * et ce qu'il recoupera avec ses propres relevés.
 *
 * La semaine commence le **lundi**, usage français ; `getDay()` renvoyant 0 pour dimanche, on le
 * ramène à 6 plutôt que de reculer d'un jour comme le ferait un décalage naïf.
 */
export function periodeDe(raccourci: RaccourciPeriode, aujourdHui = new Date()): Periode {
  const fin = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
  const debut = new Date(fin);

  switch (raccourci) {
    case "jour":
      break;
    case "semaine": {
      const jour = (fin.getDay() + 6) % 7;
      debut.setDate(fin.getDate() - jour);
      break;
    }
    case "mois":
      debut.setDate(1);
      break;
    case "trimestre":
      debut.setMonth(Math.floor(fin.getMonth() / 3) * 3, 1);
      break;
    case "semestre":
      debut.setMonth(fin.getMonth() < 6 ? 0 : 6, 1);
      break;
    case "annee":
      debut.setMonth(0, 1);
      break;
  }

  return { debut: iso(debut), fin: iso(fin) };
}
