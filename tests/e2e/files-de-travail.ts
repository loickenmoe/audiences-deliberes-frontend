import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Finds a row in a work queue, whatever page it is on.
 *
 * Work queues (publications to validate, deletion requests, filings to sign) are FIFO, oldest
 * first, and paginated by ten. A newly added item is therefore last, so searching only the first
 * page would make the assertion depend on the queue size. Walking through the pages makes the
 * assertion check what it claims; increasing the page size would only push the threshold further.
 */
export async function ligneDansLaFile(
  portee: Page | Locator,
  motif: RegExp | string,
): Promise<Locator> {
  /*
   * `portee` is the page, or a region with its own pagination (the hearing log has two on the same
   * screen). Searching the whole page would match the other section's rows and click its pager.
   */
  const ligne = portee.getByRole("row", { name: typeof motif === "string" ? new RegExp(motif) : motif });
  const suivante = portee.getByRole("button", { name: "Page suivante" });
  const indicateur = portee.getByText(/^Page \d+ sur \d+$/);

  // Upper bound: a queue of more than fifty pages signals another problem, and an explicit failure
  // is better than a loop that times out silently.
  for (let pagesRestantes = 50; pagesRestantes > 0; pagesRestantes--) {
    /*
     * `count()` answers immediately without waiting, but the table is repopulated after the page
     * indicator changes. Give each page a short but real delay (short because several pages may be
     * visited).
     */
    try {
      await expect(ligne.first()).toBeVisible({ timeout: 5_000 });
      return ligne.first();
    } catch {
      // Not on this page: keep going.
    }
    if ((await suivante.count()) === 0 || (await suivante.isDisabled())) break;

    const position = await indicateur.textContent().catch(() => null);
    await suivante.click();
    /*
     * Wait until the indicator has actually changed before reading again, otherwise the previous
     * page would be read. The indicator may also disappear (a reloaded queue can fall back to a
     * single page, which renders no pager); `not.toHaveText` would fail on "element(s) not found",
     * so the text is read manually and absence counts as a change.
     */
    await expect
      .poll(() => indicateur.textContent().catch(() => null), { timeout: 30_000 })
      .not.toBe(position);
  }

  throw new Error(`Aucune ligne correspondant à ${motif} dans cette file, toutes pages parcourues`);
}
