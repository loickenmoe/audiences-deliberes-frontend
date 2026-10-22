import type { CategorieDossier } from "@/types/enums";

/**
 * Types of documents filed in the DMS.
 *
 * The backend treats `typeDocument` as free text, so stable codes are sent and translated on
 * display. An unknown type (filed through another channel, such as the backend-generated
 * engagement letter) is displayed as is.
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
 * Type of a signed engagement letter filed by the backend
 * (`ConstitutionService.TYPE_DOCUMENT_LETTRE`); it enables printing on pre-printed paper in the
 * Documents tab. Being free text server-side, the match is checked by an end-to-end test.
 */
export const TYPE_LETTRE_CONSTITUTION = "Lettre de constitution";

export function estTypeConnu(valeur: string | null | undefined): valeur is TypeDocument {
  return !!valeur && (TypesDocument as readonly string[]).includes(valeur);
}

/**
 * Documents required by the case file category. The attached files are mandatory at creation; the
 * references naming them are optional.
 *
 * Only the screen enforces this rule: documents are filed in the DMS after creation, which alone
 * produces the case file id, so the server cannot require them.
 */
export function piecesDeCategorie(categorie: CategorieDossier): TypeDocument[] {
  return categorie === "RECOUVREMENT"
    ? ["DOSSIER_CREDIT", "PV_TRANSFERT"]
    : ["INCIDENT_COMPTE", "ELEMENT_JUSTIFICATIF"];
}

export type NatureApercu = "pdf" | "image" | "texte" | "word" | "word-ancien" | null;

/**
 * What the browser can preview, derived from the extension as the backend derives the format. XLSX
 * has no preview and is downloaded.
 *
 * `.docx` (XML archive) can be rendered in the page; `.doc` (Word 97-2003 binary) cannot, so the
 * screen can tell the user to re-save it as `.docx`.
 */
export function natureApercu(nomFichier: string): NatureApercu {
  const extension = nomFichier.slice(nomFichier.lastIndexOf(".") + 1).toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "png" || extension === "jpg" || extension === "jpeg") return "image";
  if (extension === "txt") return "texte";
  if (extension === "docx") return "word";
  if (extension === "doc") return "word-ancien";
  return null;
}

/**
 * Saves content under its original file name.
 *
 * A direct MinIO link would not work: `download` is ignored cross-origin. A local `Blob` avoids
 * this, which requires MinIO CORS to allow the application origin.
 */
export function telechargerBlob(contenu: Blob, nomFichier: string) {
  const url = URL.createObjectURL(contenu);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Give the browser time to start the download before releasing the object.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
