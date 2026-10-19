import { expect, type Page } from "@playwright/test";

/**
 * Picks the originating branch in the case creation form.
 *
 * Mandatory: the branch code is a choice from the branch reference data, and the backend rejects
 * creation without it. The first option is taken without naming it, because the reference data
 * may change (a hard-coded code would break when a branch is closed or renamed).
 */
export async function choisirAgenceOrigine(page: Page) {
  const champ = page.getByRole("combobox", { name: /Agence d.origine/ });
  await champ.click();
  const liste = page.getByRole("listbox", { name: /Agence d.origine/ });
  const option = liste.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  /*
   * The field shows "code · name · city". Check it is no longer empty rather than comparing it with
   * the option text: the option also includes the address, which `textContent` glues to the label.
   */
  await expect(champ).not.toHaveValue("");
  return (await champ.inputValue()).trim();
}
