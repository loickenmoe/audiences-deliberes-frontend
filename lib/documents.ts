import type { CategorieDossier } from "@/types/enums";

/**
 * Types de pièces déposées en GED.
 *
 * Le backend traite `typeDocument` comme un **texte libre** (Q-45) : rien n'empêche d'y écrire
 * « PV », « pv de transfert » ou « Procès-verbal ». On y envoie donc des **codes stables**,
 * traduits à l'affichage — sans quoi une même pièce porterait trois noms, et aucun ne serait
 * traduisible. Un type inconnu (déposé par un autre canal, comme la lettre de constitution que le
 * backend génère) s'affiche tel quel.
 */
export const TypesDocument = [
  "DOSSIER_CREDIT",
  "PV_TRANSFERT",
  "INCIDENT_COMPTE",
  "ELEMENT_JUSTIFICATIF",
  "AUTRE",
] as const;
export type TypeDocument = (typeof TypesDocument)[number];

export function estTypeConnu(valeur: string | null | undefined): valeur is TypeDocument {
  return !!valeur && (TypesDocument as readonly string[]).includes(valeur);
}

/**
 * Pièces qui accompagnent les références exigées par la catégorie (Q-11). Les références restent
 * obligatoires côté backend ; les pièces, elles, sont **facultatives** à la création : le dossier
 * de crédit est remis manuellement par le GFC (RG-GED-01) et peut arriver après l'ouverture.
 */
export function piecesDeCategorie(categorie: CategorieDossier): TypeDocument[] {
  return categorie === "RECOUVREMENT"
    ? ["DOSSIER_CREDIT", "PV_TRANSFERT"]
    : ["INCIDENT_COMPTE", "ELEMENT_JUSTIFICATIF"];
}

export type NatureApercu = "pdf" | "image" | "texte" | null;

/**
 * Ce que le navigateur sait afficher. Dérivé de l'extension, comme le backend dérive le format
 * (Q-46). Un XLSX n'a pas d'aperçu possible dans un navigateur : il se télécharge.
 */
export function natureApercu(nomFichier: string): NatureApercu {
  const extension = nomFichier.slice(nomFichier.lastIndexOf(".") + 1).toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "png" || extension === "jpg" || extension === "jpeg") return "image";
  if (extension === "txt") return "texte";
  return null;
}

/**
 * Déclenche l'enregistrement d'un contenu **sous son nom d'origine**.
 *
 * Un lien direct vers l'URL MinIO ne le permettrait pas : l'attribut `download` est ignoré sur une
 * autre origine, et le navigateur ouvrirait le fichier au lieu de l'enregistrer. Passer par un
 * `Blob` local lève la contrainte — c'est possible parce que MinIO autorise l'origine de
 * l'application (CORS vérifié le 2026-09-10, QF-06).
 */
export function telechargerBlob(contenu: Blob, nomFichier: string) {
  const url = URL.createObjectURL(contenu);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Laisser au navigateur le temps de démarrer l'enregistrement avant de libérer l'objet.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
