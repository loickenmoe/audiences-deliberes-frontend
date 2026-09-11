import { expect, test, type Page } from "@playwright/test";

/**
 * Audiences, alarmes et calendrier (écrans 09, 11, 22 à 25) **contre le backend réel**.
 *
 * Limite assumée : le backend n'accepte une audience qu'à une date **future**, et son compte rendu
 * qu'à partir du jour de l'audience. Aucun parcours ne peut donc saisir un compte rendu sans attendre
 * que la date passe ; on vérifie ici qu'il n'est **pas** proposé trop tôt. La saisie elle-même est
 * couverte par les tests du backend.
 */

const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** `YYYY-MM-DD` local, dans `jours` jours. */
function dansJours(jours: number) {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * La ligne dont la **cellule de statut** vaut exactement `statut`. Un `filter({ hasText })` ne suffit
 * pas : il compare une sous-chaîne sans tenir compte de la casse, et le bouton « Marquer traitée »
 * d'une alarme active suffisait à la compter parmi les « Traitée ».
 */
function ligneAuStatut(page: Page, statut: string) {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: statut, exact: true }) });
}

/** Crée un dossier et fait passer son instance « En cours » : la condition d'une audience. */
async function dossierEnCours(page: Page) {
  const reference = `DOS-AUD-${suffixe()}`;
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Référence", { exact: true }).fill(reference);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD-AUD");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV-AUD");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  await page.getByRole("tab", { name: "Étapes" }).click();
  await page.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await page.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Statut de l’étape mis à jour.")).toBeVisible();
  return reference;
}

test("sans étape en cours, la planification est expliquée plutôt que proposée", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Référence", { exact: true }).fill(`DOS-AUD-${suffixe()}`);
  await page.getByLabel("Nature du dossier", { exact: true }).selectOption("Assignation en paiement");
  await page.getByLabel("Juridiction saisie", { exact: true }).fill("TGI Douala");
  await page.getByLabel("Client", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Risque encouru (FCFA)", { exact: true }).fill("5000000");
  await page.getByLabel("Dossier de crédit d’origine", { exact: true }).fill("CRD");
  await page.getByLabel("PV de transfert", { exact: true }).fill("PV");
  await page.getByLabel("Juristes affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByLabel("Avocats affectés", { exact: true }).selectOption({ index: 0 });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForURL(/\/dossiers\/\d+$/, { timeout: 60_000 });

  await page.getByRole("tab", { name: "Audiences" }).click();
  // L'instance est encore « Ouverture » : le backend refuserait (RG-AUD-01).
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
      // Même étape, même date : le backend demande confirmation, il ne refuse pas.
      const confirmation = page.getByRole("dialog", { name: "Confirmer l’audience" });
      await expect(confirmation).toBeVisible();
      await confirmation.getByRole("button", { name: "Confirmer" }).click();
    }
    // Attendre la **nouvelle** ligne, pas le message : le toast de la première tentative reste à
    // l'écran et masquait l'échec de la seconde.
    await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(tentative);
  }

  await expect(page.getByRole("row").filter({ hasText: "Planifiée" })).toHaveCount(2);
  // Audience à venir : le compte rendu n'est pas encore recevable, donc pas proposé.
  await expect(page.getByRole("button", { name: "Saisir le compte rendu" })).toHaveCount(0);
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

  // Le motif reste lisible dans la liste ; l'audience n'est plus proposée à l'annulation.
  await expect(page.getByRole("row").filter({ hasText: "Motif : Renvoi prononcé par le tribunal" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Annuler l’audience du / })).toHaveCount(0);

  // Même étape, même date : l'audience annulée ne compte plus — pas de demande de confirmation.
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

  await page.getByRole("button", { name: "Marquer traitée — Appeler l’huissier" }).click();
  const confirmation = page.getByRole("dialog", { name: "Marquer l’alarme comme traitée" });
  await confirmation.getByRole("button", { name: "Marquer traitée" }).click();

  // Une seule ligne, close — contrairement à la reprogrammation, aucune remplaçante.
  await expect(ligneAuStatut(page, "Traitée")).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "Appeler l’huissier" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Reprogrammer — Appeler l’huissier" })).toHaveCount(0);
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

  await page.getByRole("button", { name: "Reprogrammer — Relancer le greffe" }).click();
  const reprog = page.getByRole("dialog", { name: "Reprogrammer l’alarme" });
  await reprog.getByLabel("Échéance", { exact: true }).fill(`${dansJours(8)}T10:00`);
  await reprog.getByRole("button", { name: "Reprogrammer" }).click();
  await expect(page.getByText("Alarme reprogrammée.")).toBeVisible();

  // Deux lignes : l'ancienne « Traitée », la nouvelle « Active » qui la cite.
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

  // Demain peut tomber la semaine suivante (un lundi) : la vue trimestrielle le contient, sauf le
  // dernier jour d'un trimestre. On calcule le trimestre plutôt que de sonder l'écran : un
  // `isVisible()` pendant le chargement répondait « non » et faisait avancer d'un trimestre de trop.
  await page.getByRole("button", { name: "Trimestre" }).click();
  const trimestre = (date: Date) => Math.floor(date.getMonth() / 3) + date.getFullYear() * 4;
  const aujourdHui = new Date();
  const lendemain = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate() + 1);
  if (trimestre(lendemain) !== trimestre(aujourdHui)) {
    await page.getByRole("button", { name: "Période suivante" }).click();
  }
  await expect(page.getByRole("link", { name: reference })).toBeVisible();
  // L'intervalle affiché porte bien ses deux dates (régression : « Du au », arguments mal passés).
  await expect(page.getByText(/^Du .+ au .+/)).toBeVisible();

  const pdf = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en PDF" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/^calendrier-trimestrielle-\d{4}-\d{2}-\d{2}\.pdf$/);

  const excel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en Excel" }).click();
  expect((await excel).suggestedFilename()).toMatch(/\.xlsx$/);
});

test("le calendrier est réservé au juriste et au DJ", async ({ page }) => {
  await seConnecter(page, "assistante.test");
  await page.goto("/audiences/calendrier");
  await expect(page.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();
});

test("le calendrier est traduit", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.getByRole("button", { name: "en", exact: true }).click();
  // Le choix de langue passe par une action serveur : attendre qu'il soit appliqué avant de naviguer,
  // sinon la page suivante part encore en français.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/audiences/calendrier");
  await expect(page.getByRole("heading", { name: "Hearing calendar", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export as PDF" })).toBeVisible();
});
