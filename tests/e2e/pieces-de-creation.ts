import type { Page } from "@playwright/test";

/**
 * Uploads the documents required to create a case.
 *
 * Files are mandatory at creation and the references naming them are optional; without them the
 * screen refuses to save. A journey that checks the uploaded file name calls this first, then sets
 * its own file on the relevant zone (`setInputFiles` replaces the previous one).
 */
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");

/** Expected documents per category, mirroring `piecesDeCategorie` in the application. */
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
