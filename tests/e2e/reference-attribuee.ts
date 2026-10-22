import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Reads the reference the system has just assigned (references are no longer entered by hand).
 *
 * The reference is recognised by its format rather than a `data-testid`: the format is a system
 * guarantee checked server-side, whereas a test attribute can be removed silently. `.first()` takes
 * the header one, which precedes any other occurrence in the DOM.
 */
const FORME_DOSSIER = /^DOS-\d{4}-\d{4,}$/;
const FORME_CLIENT = /^CLI-\d{4}-\d{4,}$/;

/** The reference shown on the case page that was just opened. */
export async function referenceDuDossier(page: Page): Promise<string> {
  return lire(page.getByText(FORME_DOSSIER).first());
}

/** A client reference within the given scope (usually the table row). */
export async function referenceDuClient(portee: Page | Locator): Promise<string> {
  return lire(portee.getByText(FORME_CLIENT).first());
}

async function lire(element: Locator): Promise<string> {
  await expect(element).toBeVisible({ timeout: 30_000 });
  const texte = (await element.textContent())?.trim();
  if (!texte) {
    throw new Error("référence attribuée introuvable à l'écran");
  }
  return texte;
}
