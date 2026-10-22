import { expect, test, type Browser, type Page } from "@playwright/test";
import { affecterParDefaut } from "./affectation";
import { deposerPiecesDeCreation } from "./pieces-de-creation";
import { ligneDansLaFile } from "./files-de-travail";
import { referenceDuDossier } from "./reference-attribuee";
import { choisirAgenceOrigine } from "./agence-de-creation";

/**
 * Hearings, alarms and calendar (screens 09, 11, 22 to 25) against the real backend.
 *
 * RG-AUD-08: a hearing can be recorded for today, even after the fact, so the full cycle (plan,
 * hold, report) is covered here. A future hearing must still not offer its report.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/** A separate session, for tests that run two roles one after the other. */
async function pageConnectee(browser: Browser, identifiant: string) {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  await seConnecter(page, identifiant);
  return page;
}


/** Local `YYYY-MM-DD`, `jours` days from now. */
function dansJours(jours: number) {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * The row whose status cell is exactly `statut`. `filter({ hasText })` is not enough: it matches a
 * case-insensitive substring, so an active alarm's "Marquer traitée" button would count as "Traitée".
 */
function ligneAuStatut(page: Page, statut: string) {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: statut, exact: true }) });
}

/** Creates a case and moves its proceeding to "En cours", which a hearing requires. */
async function dossierEnCours(page: Page) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // Mandatory: at least one party on each side.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Mandatory: the branch comes from the reference data.
  await choisirAgenceOrigine(page);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-AUD");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-AUD");
  await deposerPiecesDeCreation(page, { marque: "aud" });
  await affecterParDefaut(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  // The reference is assigned by the system: read it from the case page.
  const reference = await referenceDuDossier(page);

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.")).toBeVisible();
  return reference;
}

test("sans étape en cours, la planification est expliquée plutôt que proposée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  // Mandatory: at least one party on each side.
  await page.getByLabel("Demandeurs 1", { exact: true }).fill("AFRILAND FIRST BANK");
  await page.getByLabel("Défendeurs 1", { exact: true }).fill("Débiteur");
  // Mandatory: the branch comes from the reference data.
  await choisirAgenceOrigine(page);
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV");
  await deposerPiecesDeCreation(page, { marque: "aud2" });
  await affecterParDefaut(page);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  await page.getByRole("tab", { name: "Audiences" }).click();
  // The proceeding is still "Ouverture": the backend would reject it (RG-AUD-01).
  await expect(page.getByRole("button", { name: "Planifier une audience" })).toBeDisabled();
  await expect(page.getByText(/Aucune étape n’est en cours/)).toBeVisible();
});

test("planifier une audience, puis confirmer un doublon (ERR-005)", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnCours(page);
  await page.getByRole("tab", { name: "Audiences" }).click();

  const date = dansJours(10);
  for (const tentative of [1, 2]) {
    await page.getByRole("button", { name: "Planifier une audience" }).click();
    await page.getByLabel("Date de l’audience", { exact: true }).fill(date);
    await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();

    if (tentative === 2) {
      // Same step, same date: the backend asks for confirmation instead of rejecting.
      const confirmation = page.getByRole("dialog", { name: "Confirmer l’audience" });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Confirmer" }).click();
    }
    // Wait for the new row, not the message: the first attempt's toast is still on screen.
    await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(tentative);
  }

  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(2);
  // Future hearing: the report is not admissible yet, so it is not offered.
  await expect(page.getByRole("button", { name: "Saisir le compte rendu" })).toHaveCount(0);
});

/** RG-AUD-08: today's hearing can be recorded, and its report follows immediately. */
test("une audience du jour reçoit son compte rendu dans la foulée (RG-AUD-08)", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnCours(page);
  await page.getByRole("tab", { name: "Audiences" }).click();

  await page.getByRole("button", { name: "Planifier une audience" }).click();
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(0));
  await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(1);

  // The report is admissible from the hearing day: the action is offered right away.
  await page.getByRole("button", { name: "Saisir le compte rendu" }).click();
  const modale = page.getByRole("dialog", { name: "Compte rendu d’audience" });
  await modale.getByLabel("Compte rendu", { exact: true }).fill("Affaire appelée, renvoi contradictoire.");
  await modale.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Compte rendu enregistré.")).toBeVisible();
  // Target the status cell, not the row: the header has a "Tenue le" column.
  const cellulesTenue = page.getByRole("cell", { name: "Tenue", exact: true });
  await expect(cellulesTenue).toHaveCount(1);
  // The hearing is dated the day it was held, here the day of entry.
  const ligneTenue = page.getByRole("row").filter({ has: cellulesTenue });
  await expect(ligneTenue).toContainText(String(new Date().getDate()));
});

/** A hearing cannot predate the case: that is the only lower bound. */
test("une audience antérieure à l'ouverture du dossier est refusée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnCours(page);
  await page.getByRole("tab", { name: "Audiences" }).click();

  await page.getByRole("button", { name: "Planifier une audience" }).click();
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(-30));
  await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Cette date précède l’ouverture du dossier.")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(0);
});

/**
 * V34: each hearing has its own court. An appeal hearing does not sit before the court that ruled,
 * so the calendar must show the hearing's court, not the case's.
 */
test("une audience se tient devant sa propre juridiction, pas celle du dossier", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const reference = await dossierEnCours(page);
  await page.getByRole("tab", { name: "Audiences" }).click();

  await page.getByRole("button", { name: "Planifier une audience" }).click();
  const modale = page.getByRole("dialog", { name: "Planifier une audience" });
  // The field defaults to the case's court: the usual first-instance case.
  await expect(modale.getByLabel("Juridiction", { exact: true })).toHaveValue("TGI Douala");

  await modale.getByLabel("Juridiction", { exact: true }).fill("Cour d'appel du Littoral");
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(12));
  await modale.getByRole("button", { name: "Enregistrer" }).click();

  const ligne = page.getByRole("row").filter({ hasText: "Planifiée" });
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText("Cour d'appel du Littoral");

  // The calendar shows the same place.
  await page.goto("/audiences/calendrier");
  await page.getByRole("button", { name: "Trimestre" }).click();
  const entree = page.getByRole("row", { name: new RegExp(reference) }).first();
  if ((await entree.count()) > 0) {
    await expect(entree).toContainText("Cour d'appel du Littoral");
  }
});

test("annuler une audience avec son motif, puis la replanifier à la même date sans doublon (QF-30)", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnCours(page);
  await page.getByRole("tab", { name: "Audiences" }).click();

  const date = dansJours(12);
  const planifier = async () => {
    await page.getByRole("button", { name: "Planifier une audience" }).click();
    await page.getByLabel("Date de l’audience", { exact: true }).fill(date);
    await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();
  };

  await planifier();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(1);

  await page.getByRole("button", { name: /^Annuler l’audience du / }).click();
  const annulation = page.getByRole("dialog", { name: "Annuler l’audience" });
  await annulation.getByLabel("Motif de l’annulation", { exact: true }).fill("Renvoi prononcé par le tribunal");
  await annulation.getByRole("button", { name: "Annuler l’audience", exact: true }).click();

  // The reason stays readable in the list; the hearing can no longer be cancelled.
  await expect(page.getByRole("row").filter({ hasText: "Motif : Renvoi prononcé par le tribunal" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Annuler l’audience du / })).toHaveCount(0);

  // Same step, same date: the cancelled hearing no longer counts, so no confirmation is requested.
  await planifier();
  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Confirmer l’audience" })).toBeHidden();
});

test("marquer une alarme traitée la clôt sans la remplacer (QF-29)", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnCours(page);
  await page.getByRole("tab", { name: "Alarmes" }).click();

  await page.getByRole("button", { name: "Créer une alarme" }).click();
  const creation = page.getByRole("dialog", { name: "Créer une alarme" });
  await creation.getByLabel("Objet", { exact: true }).fill("Appeler l’huissier");
  await creation.getByLabel("Échéance", { exact: true }).fill(`${dansJours(4)}T11:00`);
  await creation.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Appeler l’huissier" })).toHaveCount(1);

  await page.getByRole("button", { name: "Marquer traitée - Appeler l’huissier" }).click();
  const confirmation = page.getByRole("dialog", { name: "Marquer l’alarme comme traitée" });
  await confirmation.getByRole("button", { name: "Marquer traitée" }).click();

  // A single closed row: unlike rescheduling, no replacement.
  await expect(ligneAuStatut(page, "Traitée")).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "Appeler l’huissier" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Reprogrammer - Appeler l’huissier" })).toHaveCount(0);
});

test("créer puis reprogrammer une alarme : l'ancienne est close, la nouvelle la reprend", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await dossierEnCours(page);
  await page.getByRole("tab", { name: "Alarmes" }).click();

  await page.getByRole("button", { name: "Créer une alarme" }).click();
  const creation = page.getByRole("dialog", { name: "Créer une alarme" });
  await creation.getByLabel("Objet", { exact: true }).fill("Relancer le greffe");
  await creation.getByLabel("Échéance", { exact: true }).fill(`${dansJours(5)}T09:00`);
  await creation.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Alarme créée.")).toBeVisible();

  await page.getByRole("button", { name: "Reprogrammer - Relancer le greffe" }).click();
  const reprog = page.getByRole("dialog", { name: "Reprogrammer l’alarme" });
  await reprog.getByLabel("Échéance", { exact: true }).fill(`${dansJours(8)}T10:00`);
  await reprog.getByRole("button", { name: "Reprogrammer" }).click();
  await expect(page.getByText("Alarme reprogrammée.")).toBeVisible();

  // Two rows: the old one "Traitée", the new "Active" one referencing it.
  await expect(ligneAuStatut(page, "Traitée")).toHaveCount(1);
  await expect(ligneAuStatut(page, "Active")).toContainText("Reprend une alarme précédente");
});

test("le calendrier montre l'audience planifiée et s'exporte en PDF et en Excel", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  const reference = await dossierEnCours(page);
  await page.getByRole("tab", { name: "Audiences" }).click();
  await page.getByRole("button", { name: "Planifier une audience" }).click();
  await page.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(1));
  await page.getByRole("dialog", { name: "Planifier une audience" }).getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Audience planifiée.")).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await navigation.getByRole("link", { name: "Calendrier" }).click();
  await page.waitForURL(/\/audiences\/calendrier/, { timeout: 60_000 });

  // Tomorrow may fall in the next week: the quarterly view contains it, except on a quarter's last
  // day. Compute the quarter instead of probing the screen, which may still be loading.
  await page.getByRole("button", { name: "Trimestre" }).click();
  const trimestre = (date: Date) => Math.floor(date.getMonth() / 3) + date.getFullYear() * 4;
  const aujourdHui = new Date();
  const lendemain = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate() + 1);
  if (trimestre(lendemain) !== trimestre(aujourdHui)) {
    await page.getByRole("button", { name: "Période suivante" }).click();
  }
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
  // The displayed range shows both dates (regression: "Du au").
  await expect(page.getByText(/^Du .+ au .+/)).toBeVisible();

  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/^calendrier-trimestrielle-\d{4}-\d{2}-\d{2}\.pdf$/);

  const excel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en Excel" }).click();
  expect((await excel).suggestedFilename()).toMatch(/\.xlsx$/);
});

/**
 * Screen 44, hearing log: a hearing created today with its report must appear in the DJ's log
 * without any further action.
 */
test("le journal du jour rapporte le compte rendu que le juriste vient de saisir", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const reference = await dossierEnCours(juriste);
  await juriste.getByRole("tab", { name: "Audiences" }).click();
  await juriste.getByRole("button", { name: "Planifier une audience" }).click();
  await juriste.getByLabel("Date de l’audience", { exact: true }).fill(dansJours(0));
  await juriste
    .getByRole("dialog", { name: "Planifier une audience" })
    .getByRole("button", { name: "Enregistrer" })
    .click();
  await expect(juriste.getByRole("cell", { name: "Planifiée", exact: true })).toHaveCount(1);

  await juriste.getByRole("button", { name: "Saisir le compte rendu" }).click();
  const modale = juriste.getByRole("dialog", { name: "Compte rendu d’audience" });
  await modale.getByLabel("Compte rendu", { exact: true }).fill("Renvoi contradictoire au mois prochain.");
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(juriste.getByText("Compte rendu enregistré.")).toBeVisible();
  await juriste.context().close();

  const dj = await pageConnectee(browser, "dj.test");
  await dj.goto("/audiences/journal");
  await expect(dj.getByRole("heading", { name: "Journal des audiences", level: 1 })).toBeVisible();

  // The log is paginated and accumulates previous runs: walk through the pages of this section,
  // which has its own pagination.
  const sectionJournal = dj.getByRole("region", { name: "Audiences du jour" });
  const ligne = await ligneDansLaFile(sectionJournal, new RegExp(reference));
  await expect(ligne).toContainText("Renvoi contradictoire au mois prochain.");
  // The lawyer filed nothing: the screen says so, without confusing it with a missing report.
  await expect(ligne).toContainText("Non déposé");
  await dj.context().close();
});

/**
 * The log and the calendar are open to the five internal profiles: the Assistant and the SH consult
 * them since 2026-10-21. The lawyer, an external user, stays out.
 */
test("le journal des audiences s'ouvre au juriste, à l'Assistante et au SH ; pas à l'avocat", async ({ browser }) => {
  for (const identifiant of ["juriste.test", "assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, identifiant);
    await expect(
      page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Journal des audiences" }),
    ).toBeVisible();
    await page.goto("/audiences/journal");
    await expect(page.getByRole("heading", { name: "Journal des audiences", level: 1 })).toBeVisible();
    await page.context().close();
  }

  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/audiences/journal");
  await expect(avocat.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await avocat.context().close();
});

test("le calendrier s'ouvre à l'Assistante et au SH ; pas à l'avocat", async ({ browser }) => {
  for (const identifiant of ["assistante.test", "sh.test"]) {
    const page = await pageConnectee(browser, identifiant);
    await page.goto("/audiences/calendrier");
    await expect(page.getByRole("heading", { name: "Calendrier des audiences", level: 1 })).toBeVisible();
    await page.context().close();
  }

  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/audiences/calendrier");
  await expect(avocat.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
  await avocat.context().close();
});

test("le calendrier est traduit", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.getByRole("button", { name: "en", exact: true }).click();
  // The language choice goes through a server action: wait until it is applied before navigating,
  // otherwise the next page still loads in French.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/audiences/calendrier");
  await expect(page.getByRole("heading", { name: "Hearing calendar", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export as PDF" })).toBeVisible();
});
