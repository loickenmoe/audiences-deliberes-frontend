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

/**
 * Le type porté par une lettre de constitution signée, versée à la GED par le backend
 * (`ConstitutionService.TYPE_DOCUMENT_LETTRE`). C'est lui qui fait apparaître le tirage sur papier
 * préimprimé dans l'onglet « Documents ».
 *
 * `typeDocument` étant un texte libre côté serveur, l'alignement des deux côtés ne peut pas être
 * garanti par le typage : un parcours de bout en bout le vérifie contre le vrai backend.
 */
export const TYPE_LETTRE_CONSTITUTION = "Lettre de constitution";

export function estTypeConnu(valeur: string | null | undefined): valeur is TypeDocument {
  return !!valeur && (TypesDocument as readonly string[]).includes(valeur);
}

/**
 * Pièces qu'exige la catégorie du dossier.
 *
 * **L'obligation a changé d'objet le 2026-09-29**, sur arbitrage du métier : « ce sont les pièces
 * jointes qui sont obligatoires, pas leur texte associé ». Ces deux fichiers sont donc exigés à la
 * création, et les références qui les nomment sont devenues facultatives — l'inverse exact de
 * Q-11. Le constat qui l'a motivé : sur 254 dossiers, les deux références étaient remplies partout
 * et 51 seulement portaient un document.
 *
 * **Seul l'écran tient cette règle** : une pièce se dépose en GED après la création, qui seule
 * produit l'identifiant du dossier. Le serveur ne peut pas exiger un fichier qu'il n'a pas reçu.
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
