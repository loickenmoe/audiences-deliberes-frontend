import { expect, type Page } from "@playwright/test";

/**
 * Assigns a case in the creation form: at least one legal officer and one lawyer.
 *
 * Legal officers are picked with checkboxes, lawyers through a token search. The logged-in legal
 * officer is pre-checked; the first one is checked only when none is (e.g. when the DJ creates the
 * case). The lawyer is the first one offered, or the one named in `options.avocat`.
 */
export async function affecterParDefaut(page: Page, options: { avocat?: string } = {}) {
  const juristes = page.getByRole("group", { name: "Juristes affectés" });
  await expect(juristes.getByRole("checkbox").first()).toBeVisible({ timeout: 30_000 });
  if ((await juristes.getByRole("checkbox", { checked: true }).count()) === 0) {
    await juristes.getByRole("checkbox").first().check();
  }

  const champ = page.getByRole("combobox", { name: "Avocats affectés" });
  await champ.click();
  if (options.avocat) await champ.fill(options.avocat);
  // Search within the lawyer listbox, not the page: the first option on the page belongs to the
  // hidden native "Nature du dossier" select.
  const liste = page.getByRole("listbox", { name: "Avocats affectés" });
  const option = options.avocat
    ? liste.getByRole("option", { name: options.avocat, exact: true })
    : liste.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await champ.press("Escape");
  await expect(page.getByRole("button", { name: /Retirer$/ }).first()).toBeVisible();
}
