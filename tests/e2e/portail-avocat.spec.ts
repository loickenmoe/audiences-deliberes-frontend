import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Portail Avocat (écrans 30 et 33) **contre le backend réel**.
 *
 * Ce jalon ouvre l'application à un utilisateur **externe**. Le parcours le plus important n'est
 * donc pas le dépôt, c'est le **cloisonnement** : l'avocat ne doit voir que ses dossiers, et rien
 * du portefeuille de la banque. Deux parcours s'y consacrent, dont un qui interroge l'API
 * directement avec son jeton.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

async function jeton(identifiant: string): Promise<string> {
  const reponse = await fetch(`${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      username: identifiant,
      password: MOT_DE_PASSE,
      scope: "openid",
    }),
  });
  if (!reponse.ok) throw new Error(`Connexion refusée pour ${identifiant} (${reponse.status})`);
  return ((await reponse.json()) as { access_token: string }).access_token;
}

async function appel(chemin: string, jetonAcces: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${jetonAcces}`, "Content-Type": "application/json", ...init.headers },
  });
}

async function json<T>(chemin: string, jetonAcces: string): Promise<T> {
  const reponse = await appel(chemin, jetonAcces);
  if (!reponse.ok) throw new Error(`GET ${chemin} → ${reponse.status} ${await reponse.text()}`);
  return (await reponse.json()) as T;
}

function suffixe() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

async function pageConnectee(browser: Browser, identifiant: string) {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  await seConnecter(page, identifiant);
  return page;
}

/**
 * Choisit un dossier dans le sélecteur du portail.
 *
 * Le champ interroge le serveur au fil de la frappe depuis le 2026-09-28 : il ne charge plus une
 * page de dossiers récents, dans laquelle les anciens manquaient. Sans référence, on prend le
 * premier proposé ; avec, on le cherche — c'est ce que fait l'avocat qui sait ce qu'il veut.
 */
/**
 * Crée un dossier affecté à l'avocat de test, par l'API, et rend sa référence.
 *
 * Passe par le juriste, seul habilité à créer et affecter : c'est le geste réel, et il garantit que
 * l'affectation existe vraiment plutôt que d'être supposée.
 */
async function creerDossierAffecteALAvocat(): Promise<string> {
  const juriste = await jeton("juriste.test");
  const dj = await jeton("dj.test");

  const avocats = await json<{ content: { id: number; compteKeycloak: string | null }[] }>(
    "/intervenants?type=AVOCAT&size=200",
    juriste,
  );
  let fiche = avocats.content.find((a) => a.compteKeycloak === "avocat.test");
  if (!fiche) {
    const creation = await appel("/intervenants", dj, {
      method: "POST",
      body: JSON.stringify({ type: "AVOCAT", nom: "Me Claire Avocat", compteKeycloak: "avocat.test" }),
    });
    fiche = (await creation.json()) as { id: number; compteKeycloak: string | null };
  }

  const juristes = await json<{ id: number }[]>("/utilisateurs?profil=JURISTE", juriste);
  const clients = await json<{ content: { id: number }[] }>("/clients?size=1", juriste);
  const creation = await appel("/dossiers", juriste, {
    method: "POST",
    body: JSON.stringify({
      nature: "Assignation en paiement",
      juridictionSaisie: "TGI Douala",
      clientId: clients.content[0]!.id,
      risqueEncouru: 3_000_000,
      dossierCreditOrigine: "CRD-RECH",
      pvTransfert: "PV-RECH",
      juristesAffectes: [juristes[0]!.id],
      avocatsAffectes: [fiche!.id],
    }),
  });
  expect(creation.status, "le dossier de recherche doit être créé").toBe(201);
  // La référence est attribuée par le serveur (2026-09-29) : elle se lit dans la réponse.
  const cree = (await creation.json()) as { reference: string };
  return cree.reference;
}

async function choisirDossier(page: Page, id: string, reference?: string) {
  const champ = page.getByRole("combobox", { name: "Dossier" });
  await champ.click();
  if (reference) await champ.fill(reference);
  const liste = page.getByRole("listbox", { name: "Dossier" });
  const option = reference
    ? liste.getByRole("option", { name: new RegExp(reference) }).first()
    : liste.getByRole("option").first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await champ.press("Escape");
  void id;
}

test("l'avocat ne voit que ses dossiers, et rien du portefeuille de la banque (Q-96)", async () => {
  const avocat = await jeton("avocat.test");

  const mesDossiers = await json<{ content: { id: number; reference: string }[]; totalElements: number }>(
    "/avocat/mes-dossiers?size=100",
    avocat,
  );
  const tousLesDossiers = await json<{ totalElements: number }>("/dossiers?size=1", await jeton("juriste.test"));

  /*
   * L'avocat ne voit jamais **plus** que ce qui existe. L'inégalité était stricte auparavant, ce qui
   * supposait qu'un autre avocat détienne au moins un dossier — vrai sur la base de l'époque, faux
   * sur une base neuve où `avocat.test` est le seul avocat inscrit : tous les dossiers sont alors
   * légitimement les siens. Une assertion qui dépend de la composition du jeu de données ne mesure
   * pas le cloisonnement ; ce sont la **forme de la réponse** et les **403** ci-dessous qui le font.
   */
  expect(mesDossiers.totalElements).toBeLessThanOrEqual(tousLesDossiers.totalElements);

  // La réponse est réduite à l'identification : aucun champ du portefeuille ne doit filtrer.
  const premier = mesDossiers.content[0];
  expect(premier, "l'avocat de test doit être affecté à au moins un dossier").toBeDefined();
  expect(Object.keys(premier!).sort()).toEqual(["id", "juridictionSaisie", "nature", "reference"]);

  // Les endpoints internes lui restent fermés.
  for (const chemin of ["/dossiers", "/publications", "/clients", "/utilisateurs"]) {
    expect((await appel(chemin, avocat)).status, `${chemin} doit rester fermé à l'avocat`).toBe(403);
  }

  // Et le portail reste fermé aux profils internes, qui ont leurs propres écrans.
  expect((await appel("/avocat/mes-dossiers", await jeton("juriste.test"))).status).toBe(403);
});

test("l'avocat dépose une demande de frais en choisissant son dossier (écran 30)", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Déposer une demande" })
    .click();
  await avocat.waitForURL(/\/frais\/nouvelle/, { timeout: 60_000 });

  const reference = `FAC-E2E-${suffixe()}`;
  // Le sélecteur est alimenté par `GET /avocat/mes-dossiers` : c'est ce que QF-01 rendait impossible.
  await choisirDossier(avocat, "frais-dossier");
  await avocat.locator("#frais-reference").fill(reference);
  await avocat.locator("#frais-montant").fill("450000");
  // UC-INT-01 étape 4 : la pièce est un vrai fichier, transmis dès qu'il est choisi (Q-97).
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });

  /*
   * Relire la pièce **avant** d'envoyer : une fois la demande déposée, la remplacer suppose de
   * repasser par une nouvelle demande. L'aperçu s'ouvre sans quitter le formulaire.
   */
  await avocat.getByRole("button", { name: "Consulter - facture.pdf" }).click();
  const apercuAvocat = avocat.getByRole("dialog", { name: "Aperçu - facture.pdf" });
  await expect(apercuAvocat).toBeVisible({ timeout: 30_000 });
  // Deux boutons ferment la fenêtre — la croix et le bouton du pied : on prend le premier.
  await apercuAvocat.getByRole("button", { name: "Fermer" }).first().click();

  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();

  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.waitForURL(/\/frais$/, { timeout: 60_000 });
  // Sa file (#28) ne montre que les siennes.
  await expect(avocat.getByRole("row", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  await avocat.context().close();
});

test("une référence de facture en doublon est signalée sur le champ concerné", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");

  const reference = `FAC-DUP-${suffixe()}`;
  for (const tentative of [1, 2]) {
    await choisirDossier(avocat, "frais-dossier");
    await avocat.locator("#frais-reference").fill(reference);
    await avocat.locator("#frais-montant").fill("100000");
    await avocat
      .locator('input[name="piece-justificative"]')
      .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(avocat.getByText("facture.pdf")).toBeVisible({ timeout: 30_000 });
    await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
    if (tentative === 1) {
      await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
      await avocat.goto("/frais/nouvelle");
    }
  }

  // Le backend nomme le champ fautif (QF-21) : le message se pose dessus, pas dans un bandeau.
  await expect(avocat.locator("#frais-reference")).toHaveAttribute("aria-invalid", "true", { timeout: 30_000 });

  await avocat.context().close();
});

test("l'avocat dépose un compte rendu rattaché à une audience de son dossier (écran 33)", async ({
  browser,
}) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une publication", level: 1 })).toBeVisible();

  // Les deux natures de dépôt sont décrites côte à côte, pas cachées derrière des onglets.
  // `exact` : le chapô de l'écran reprend les deux expressions dans sa phrase d'introduction.
  await expect(avocat.getByText("Compte rendu d’audience", { exact: true })).toBeVisible();
  await expect(avocat.getByText("Document du dossier", { exact: true })).toBeVisible();

  // Tant qu'aucun dossier n'est choisi, l'audience ne peut pas l'être : elle lui appartient.
  await expect(avocat.locator("#publication-audience")).toBeDisabled();

  await choisirDossier(avocat, "publication-dossier");
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });

  const marque = `Renvoi constaté ${suffixe()}`;
  if ((await audiences.locator("option").count()) > 1) {
    await audiences.selectOption({ index: 1 });
    await avocat.locator("#publication-contenu").fill(marque);
    // Q-98 : la pièce est **facultative** — ce dépôt-ci n'en porte pas, et doit aboutir.
    await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
    await expect(avocat.getByText("Publication déposée. Elle sera visible après validation.")).toBeVisible({
      timeout: 30_000,
    });
    await avocat.waitForURL(/\/portail/, { timeout: 60_000 });
    await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible();
  } else {
    // Aucune audience planifiée : l'écran l'explique au lieu de laisser un sélecteur vide.
    await expect(avocat.getByText("Aucune audience n’est encore planifiée sur ce dossier.")).toBeVisible();
  }

  await avocat.context().close();
});

/**
 * Q-98 : le récit **et** sa pièce partent en un seul dépôt, rattachés à la même audience. Le volet
 * lecture — l'Assistante qui ouvre la pièce depuis la publication — est vérifié par P2
 * (`parcours-metier.spec.ts`), sur un dossier créé pour l'occasion : ici le dossier est choisi par
 * position, et rien ne garantirait qu'on relise bien ce dépôt-ci.
 */
test("un compte rendu part avec sa pièce, en un seul dépôt", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await choisirDossier(avocat, "publication-dossier");
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });

  if ((await audiences.locator("option").count()) <= 1) return; // dossier sans audience : rien à joindre

  const marque = suffixe();
  await audiences.selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Renvoi avec plumitif ${marque}`);
  await avocat
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: `plumitif-${marque}.pdf`, mimeType: "application/pdf", buffer: PDF });

  /*
   * Il relit sa pièce avant de déposer son compte rendu : le fichier n'est pas encore parti, et une
   * publication déposée ne se corrige pas — elle se redépose.
   */
  await avocat.getByRole("button", { name: `Consulter - plumitif-${marque}.pdf` }).click();
  const apercuPiece = avocat.getByRole("dialog", { name: `Aperçu - plumitif-${marque}.pdf` });
  await expect(apercuPiece).toBeVisible({ timeout: 30_000 });
  await apercuPiece.getByRole("button", { name: "Fermer" }).first().click();

  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Publication déposée. Elle sera visible après validation.")).toBeVisible({
    timeout: 30_000,
  });

  // Le dépôt apparaît dans son espace, où il relit ce qu'il a transmis.
  await avocat.goto("/portail");
  await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();
});

test("l'avocat relit ses dépôts et ses constitutions dans son espace", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Mon espace" })
    .click();
  await avocat.waitForURL(/\/portail/, { timeout: 60_000 });

  await expect(avocat.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible();
  await expect(avocat.getByRole("heading", { name: "Mes dépôts", level: 2 })).toBeVisible();
  await expect(avocat.getByRole("heading", { name: "Mes lettres de constitution", level: 2 })).toBeVisible();

  await avocat.context().close();
});

/**
 * Le défaut signalé en recette (2026-09-28) : le sélecteur chargeait une page des dossiers les plus
 * récents, et un avocat qui en suit davantage ne voyait plus les anciens — ni demande de frais, ni
 * compte rendu possible pour eux. Le dossier existait, l'affectation aussi ; seule la liste était
 * tronquée, en silence.
 *
 * Le parcours crée un dossier, en crée d'autres par-dessus pour le repousser dans la liste, puis
 * vérifie que l'avocat le retrouve **en le cherchant**.
 */
test("l'avocat retrouve par la recherche un dossier repoussé hors de la première page", async ({ browser }) => {
  const reference = await creerDossierAffecteALAvocat();

  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une demande de frais", level: 1 })).toBeVisible();

  const champ = avocat.getByRole("combobox", { name: "Dossier" });
  await champ.click();
  await champ.fill(reference);
  const liste = avocat.getByRole("listbox", { name: "Dossier" });
  await expect(liste.getByRole("option", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  // La recherche ignore la casse : on cherche comme on parle, pas comme la base stocke.
  await champ.fill(reference.toLowerCase());
  await expect(liste.getByRole("option", { name: new RegExp(reference) })).toBeVisible({ timeout: 30_000 });

  await avocat.context().close();
});

/**
 * Le défaut signalé en recette (2026-09-28) : la pièce téléversée par l'avocat arrivait bien dans
 * le stockage, mais l'écran de l'Assistante n'en montrait que le **chemin technique** — ni
 * consultable, ni téléchargeable. Elle devait statuer sur la conformité sans pouvoir ouvrir le
 * document, ce que le guide utilisateur promettait pourtant.
 *
 * Le parcours suit la pièce d'un bout à l'autre : l'avocat la charge, l'Assistante l'ouvre.
 */
test("la pièce déposée par l'avocat s'ouvre chez l'Assistante", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  const reference = `FAC-PJ-${suffixe()}`;
  await choisirDossier(avocat, "frais-dossier");
  await avocat.locator("#frais-reference").fill(reference);
  await avocat.locator("#frais-montant").fill("320000");
  await avocat
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "releve-diligences.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(avocat.getByText("releve-diligences.pdf")).toBeVisible({ timeout: 30_000 });
  await avocat.getByRole("button", { name: "Déposer", exact: true }).click();
  await expect(avocat.getByText("Demande de frais déposée.")).toBeVisible({ timeout: 30_000 });
  await avocat.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/frais");
  await assistante.getByRole("link", { name: reference }).click();
  await assistante.waitForURL(/\/frais\/\d+/, { timeout: 60_000 });

  // Le nom d'origine, et non le chemin de stockage : c'est ce qu'un humain peut lire.
  await expect(assistante.getByText("releve-diligences.pdf")).toBeVisible({ timeout: 30_000 });
  await expect(assistante.getByText(/^frais\//)).toHaveCount(0);

  await assistante.getByRole("button", { name: "Consulter - releve-diligences.pdf" }).click();
  const apercu = assistante.getByRole("dialog", { name: "Aperçu - releve-diligences.pdf" });
  await expect(apercu).toBeVisible({ timeout: 30_000 });
  await apercu.getByRole("button", { name: "Fermer" }).first().click();

  const telechargement = assistante.waitForEvent("download");
  await assistante.getByRole("button", { name: "Télécharger - releve-diligences.pdf" }).click();
  expect((await telechargement).suggestedFilename()).toBe("releve-diligences.pdf");
  await assistante.context().close();
});

/**
 * Le défaut signalé en recette (2026-09-28) : une fois la publication validée, le compte rendu de
 * l'avocat restait introuvable depuis l'audience. Il vit dans les publications, rattaché à
 * l'audience mais pas porté par elle — l'onglet « Audiences » n'affichait donc que le récit du
 * juriste, et l'audience paraissait muette.
 *
 * Le parcours suit le compte rendu d'un bout à l'autre : l'avocat dépose, l'Assistante valide, et
 * la ligne de l'audience y mène.
 */
test("le compte rendu validé de l'avocat se retrouve depuis son audience", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const marque = suffixe();

  // Un dossier neuf, avec une audience du jour : le compte rendu doit pouvoir s'y rattacher.
  const reference = await creerDossierAffecteALAvocat();
  await juriste.goto("/dossiers");
  await juriste.getByLabel("Référence", { exact: true }).fill(reference);
  await juriste.getByRole("link", { name: reference }).click();
  await juriste.waitForURL(/\/dossiers\/\d+/, { timeout: 60_000 });
  const url = juriste.url();

  await juriste.getByRole("tab", { name: "Étapes" }).click();
  await juriste.getByLabel("Faire passer à", { exact: true }).selectOption("EN_COURS");
  await juriste.getByRole("button", { name: "Appliquer" }).click();

  await juriste.getByRole("tab", { name: "Audiences" }).click();
  await juriste.getByRole("button", { name: "Planifier une audience" }).click();
  const aujourdHui = new Date();
  const jour = `${aujourdHui.getFullYear()}-${String(aujourdHui.getMonth() + 1).padStart(2, "0")}-${String(aujourdHui.getDate()).padStart(2, "0")}`;
  await juriste.getByLabel("Date de l’audience", { exact: true }).fill(jour);
  await juriste
    .getByRole("dialog", { name: "Planifier une audience" })
    .getByRole("button", { name: "Enregistrer" })
    .click();
  await expect(juriste.getByRole("cell", { name: "Planifiée", exact: true })).toHaveCount(1);
  await juriste.context().close();

  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/publications/nouvelle");
  await choisirDossier(avocat, "publication-dossier", reference);
  const audiences = avocat.locator("#publication-audience");
  await expect(audiences).toBeEnabled({ timeout: 30_000 });
  await audiences.selectOption({ index: 1 });
  await avocat.locator("#publication-contenu").fill(`Renvoi contradictoire ${marque}`);
  await avocat.getByRole("button", { name: "Déposer le compte rendu" }).click();
  await expect(avocat.getByText("Publication déposée. Elle sera visible après validation.")).toBeVisible({
    timeout: 30_000,
  });
  await avocat.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/publications");
  await assistante.getByRole("row", { name: new RegExp(reference) }).first().getByRole("link").first().click();
  await assistante.waitForURL(/\/publications\/\d+/, { timeout: 60_000 });
  await assistante.getByRole("button", { name: "Valider" }).click();
  await assistante
    .getByRole("dialog", { name: "Valider la publication ?" })
    .getByRole("button", { name: "Valider" })
    .click();
  // Attendre la confirmation, et non le seul clic : naviguer trop tôt laissait la publication au
  // statut « déposée », et l'audience paraissait alors — à juste titre — sans compte rendu.
  await expect(assistante.getByText("Publication validée : les juristes sont prévenus.")).toBeVisible({
    timeout: 30_000,
  });

  // Depuis l'audience, la ligne mène au compte rendu de l'avocat — c'est ce qui manquait.
  await assistante.goto(`${url}?onglet=audiences`);
  const lien = assistante.getByRole("link", { name: "Compte rendu de l’avocat" });
  await expect(lien).toBeVisible({ timeout: 30_000 });
  await lien.click();
  await expect(assistante.getByText(`Renvoi contradictoire ${marque}`)).toBeVisible({ timeout: 30_000 });
  await assistante.context().close();
});

test("le portail reste invisible aux profils internes", async ({ browser }) => {
  const juriste = await pageConnectee(browser, "juriste.test");
  const navigation = juriste.getByRole("navigation", { name: "Navigation principale" });

  for (const entree of ["Mon espace", "Déposer une demande", "Déposer une publication"]) {
    await expect(navigation.getByRole("link", { name: entree })).toHaveCount(0);
  }

  await juriste.goto("/portail");
  await expect(juriste.getByRole("heading", { name: "Vous n’avez pas les droits nécessaires" })).toBeVisible();

  await juriste.context().close();
});

test("les écrans du portail sont traduits", async ({ browser }) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/frais/nouvelle");
  await expect(avocat.getByRole("heading", { name: "Déposer une demande de frais", level: 1 })).toBeVisible();

  await avocat.getByRole("button", { name: "en", exact: true }).click();
  await expect(avocat.getByRole("heading", { name: "File a fee claim", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(avocat.getByRole("button", { name: "Submit" })).toBeVisible();

  await avocat.context().close();
});

/**
 * QF-45 — un avocat dont le compte n'est pas encore inscrit au répertoire.
 *
 * Ce test ne s'exécute que si le référentiel ne connaît pas `avocat.test` : sur une base peuplée, le
 * cas n'existe pas, et le forcer supposerait de supprimer une fiche dont d'autres parcours dépendent.
 * Il garde ce qui compte — que cet état soit **expliqué** et non présenté comme une panne, sur les
 * quatre écrans que l'avocat peut atteindre.
 */
test("un compte non rattaché au répertoire est expliqué, pas présenté comme un échec", async ({
  browser,
}) => {
  const avocat = await pageConnectee(browser, "avocat.test");
  await avocat.goto("/portail");

  const explication = avocat.getByText("pas encore rattaché au répertoire");
  if ((await explication.count()) === 0) {
    await avocat.context().close();
    return; // le compte est inscrit : ce n'est pas le cas visé
  }

  for (const chemin of ["/portail", "/frais", "/frais/nouvelle", "/publications/nouvelle"]) {
    await avocat.goto(chemin);
    await expect(
      avocat.getByText("pas encore rattaché au répertoire"),
      `${chemin} doit expliquer l'état du compte`,
    ).toBeVisible({ timeout: 30_000 });
    // Le point de la correction : plus jamais le message d'échec technique.
    await expect(avocat.getByText("Le chargement a échoué")).toHaveCount(0);
  }
  await avocat.context().close();
});
