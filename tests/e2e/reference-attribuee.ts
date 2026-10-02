import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Lit la référence que le système vient d'attribuer.
 *
 * <b>Pourquoi ce module existe.</b> Depuis le 2026-09-29 les références ne sont plus saisies : les
 * parcours ne peuvent plus choisir `DOS-DEL-4F2A` puis le rechercher. Ils créent, puis lisent ce qui
 * a été attribué.
 *
 * On la reconnaît à sa **forme** plutôt qu'à un `data-testid` : le format est une promesse du
 * système, vérifiée par ailleurs côté serveur, alors qu'un attribut posé pour les tests n'engage
 * personne et se retire sans que rien n'échoue. `.first()` prend celle de l'en-tête, qui précède
 * toute autre occurrence dans le DOM.
 */
const FORME_DOSSIER = /^DOS-\d{4}-\d{4,}$/;
const FORME_CLIENT = /^CLI-\d{4}-\d{4,}$/;

/** La référence affichée sur la fiche du dossier qu'on vient d'ouvrir. */
export async function referenceDuDossier(page: Page): Promise<string> {
  return lire(page.getByText(FORME_DOSSIER).first());
}

/** La référence d'un client, dans la portée donnée — la ligne du tableau, le plus souvent. */
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
