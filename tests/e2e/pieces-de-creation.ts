import type { Page } from "@playwright/test";

/**
 * Dépose les pièces qu'exige la création d'un dossier.
 *
 * **Pourquoi ce module existe.** Depuis le 2026-09-29, les fichiers sont obligatoires à la création
 * et les références qui les nomment sont devenues facultatives — l'inverse de la règle d'origine
 * (Q-11 amendée). Neuf parcours créent un dossier ; sans ce dépôt, l'écran refuse d'enregistrer et
 * ils échouent tous au même endroit, pour une raison qui n'a rien à voir avec ce qu'ils vérifient.
 *
 * Le dépôt est écrit ici une fois, plutôt que recopié neuf fois : le jour où la liste des pièces
 * attendues changera, un seul endroit le saura.
 *
 * Un parcours qui vérifie le **nom** du fichier déposé appelle cette fonction d'abord, puis repose
 * son propre fichier sur la zone concernée — `setInputFiles` remplace le précédent.
 */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

/** Les pièces attendues par catégorie, miroir de `piecesDeCategorie` côté application. */
const PIECES = {
  RECOUVREMENT: ["DOSSIER_CREDIT", "PV_TRANSFERT"],
  EXPLOITATION_LITIGES: ["INCIDENT_COMPTE", "ELEMENT_JUSTIFICATIF"],
} as const;

export async function deposerPiecesDeCreation(
  page: Page,
  { marque = "e2e", categorie = "RECOUVREMENT" as keyof typeof PIECES } = {},
) {
  for (const type of PIECES[categorie]) {
    await page.locator(`input[name="piece-${type}"]`).setInputFiles({
      name: `${type.toLowerCase()}-${marque}.pdf`,
      mimeType: "application/pdf",
      buffer: PDF,
    });
  }
}
