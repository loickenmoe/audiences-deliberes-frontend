import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ligneDansLaFile } from "./files-de-travail";

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

/** Un nom de facture tel qu'un cabinet en produit : c'est la longueur qui cassait la rangée. */
const NOM_LONG = "facture-honoraires-cabinet-fotso-et-associes-septembre-2026.pdf";

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
      // Obligatoires depuis le 2026-10-05 (observations 1 et 3).
      parties: { demandeurs: ["AFRILAND FIRST BANK"], defendeurs: ["Débiteur", "Caution"] },
      // Obligatoire depuis le 2026-10-05 (observation 2) : 00002 = Bonanjo.
      codeAgenceOrigine: "00002",
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
    await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
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
  await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
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
  await expect(avocat.getByText("Compte rendu déposé. Il est immédiatement consultable par la Direction Juridique ; l’Assistante en accusera réception.")).toBeVisible({
    timeout: 30_000,
  });
  await avocat.context().close();

  const assistante = await pageConnectee(browser, "assistante.test");
  await assistante.goto("/publications");
  /*
   * La file est **FIFO et paginée** : le compte rendu qu'on vient de déposer est le dernier, donc
   * pas sur la première page. Chercher à l'écran sans parcourir les pages ne tenait que tant que
   * la file comptait moins de dix éléments.
   */
  const ligneFile = await ligneDansLaFile(assistante, new RegExp(reference));
  await ligneFile.getByRole("link").first().click();
  await assistante.waitForURL(/\/publications\/\d+/, { timeout: 60_000 });
  /*
   * Un **compte rendu** ne se valide pas, l'Assistante en **accuse réception**. Depuis l'étape 2 du
   * lot d'améliorations, il est consultable par les juristes affectés dès son dépôt ; l'accusé de
   * réception l'ouvre aux autres et dit à l'avocat qu'il a été reçu. Le bouton « Rejeter »,
   * lui, n'est plus proposé : un récit d'audience se conteste par une correspondance.
   */
  await assistante.getByRole("button", { name: "Accuser réception" }).click();
  await assistante
    .getByRole("dialog", { name: "Accuser réception du compte rendu ?" })
    .getByRole("button", { name: "Accuser réception" })
    .click();
  // Attendre la confirmation, et non le seul clic : naviguer trop tôt laissait la publication au
  // statut « déposée », et l'audience paraissait alors — à juste titre — sans compte rendu.
  await expect(assistante.getByText("Réception du compte rendu accusée.")).toBeVisible({
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

/**
 * Les quatre défauts du formulaire de frais, relevés en recette (QF-56) — REC-E2E-041.
 *
 * **Pourquoi aucun test ne les avait vus.** Les parcours existants remplissent le formulaire
 * **correctement** : ils écrivent « 450000 », joignent une pièce, et vérifient que le dépôt passe.
 * Aucun n'avait essayé d'écrire « 12 000 », ni de cliquer « Déposer » les mains vides. Un formulaire
 * ne se juge pas seulement sur le chemin où tout va bien - c'est l'autre que l'utilisateur emprunte.
 */
test("un montant écrit avec des espaces est accepté, comme on l'écrit partout", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  const reference = `FAC-E2E-${suffixe()}`;
  await choisirDossier(page, "frais-dossier");
  await page.locator("#frais-reference").fill(reference);
  // Le défaut exact signalé en recette : le bouton restait éteint, sans un mot d'explication.
  await page.locator("#frais-montant").fill("1 250 000");
  await page
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: "facture-espaces.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("facture-espaces.pdf")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Déposer", exact: true }).click();
  // Le dépôt aboutit : la page des frais s'ouvre, et aucun message ne reproche le montant.
  await page.waitForURL(/\/frais$/, { timeout: 60_000 });
  await expect(page.getByText(reference)).toBeVisible({ timeout: 30_000 });

  await page.context().close();
});

/**
 * Le cœur de la correction : **le bouton n'est plus éteint par l'incomplétude**. Un bouton mort sans
 * explication laisse chercher lequel des quatre champs est en cause. La tentative est acceptée, et
 * ce qui manque est nommé champ par champ.
 */
test("un dépôt les mains vides nomme ce qui manque, au lieu d'un bouton éteint", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  const deposer = page.getByRole("button", { name: "Déposer", exact: true });
  await expect(deposer).toBeEnabled();
  await deposer.click();

  // Les quatre champs se plaignent, chacun chez lui.
  await expect(page.getByText("Choisissez le dossier concerné.")).toBeVisible();
  await expect(page.getByText("Indiquez la référence de la facture.")).toBeVisible();
  await expect(page.getByText("Indiquez le montant demandé.")).toBeVisible();
  await expect(page.getByText("Chargez au moins une pièce justificative.")).toBeVisible();
  // Rien n'est parti : on est resté sur le formulaire.
  await expect(page).toHaveURL(/\/frais\/nouvelle/);

  /*
   * Un montant saisi mais illisible est une autre erreur qu'un montant absent, et le message le dit
   * - en nommant ce qui est accepté plutôt qu'en refusant sans expliquer.
   */
  await page.locator("#frais-montant").fill("mille");
  await expect(page.getByText("Indiquez le montant demandé.")).toHaveCount(0);
  await deposer.click();
  await expect(page.getByText(/Le montant doit être un nombre supérieur à zéro/)).toBeVisible();

  // Corriger un champ en efface le reproche : le laisser serait accuser après coup.
  await page.locator("#frais-reference").fill("FAC-TEST");
  await expect(page.getByText("Indiquez la référence de la facture.")).toHaveCount(0);

  await page.context().close();
});

/**
 * Le risque introduit par la correction précédente, et qu'il faut tenir.
 *
 * **La rangée des pièces ne passe plus à la ligne** : si le nom du fichier ne cédait pas, elle
 * déborderait de l'écran sur un mobile. Le test de débordement général ne couvre pas cet écran - il
 * se connecte en DJ, qui ne dépose pas de frais -, et ce trou a été comblé ici plutôt que laissé.
 */
test("le formulaire de frais ne déborde pas en mobile, nom de fichier long compris", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });

  await page
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByRole("button", { name: `Consulter - ${NOM_LONG}` })).toBeVisible({
    timeout: 30_000,
  });

  const debordement = await page.evaluate(() => {
    const racine = document.documentElement;
    // Un pixel de tolérance : les arrondis de mise en page en produisent un.
    return Math.max(0, racine.scrollWidth - racine.clientWidth - 1);
  });
  expect(debordement, `le formulaire déborde de ${debordement} px en 375 px`).toBe(0);

  await page.context().close();
});

test("la pièce justificative est signalée obligatoire", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  /*
   * L'astérisque est **décorative et `aria-hidden`** : à l'intérieur du texte, la légende vaudrait
   * « Pièces justificatives* » et cesserait de correspondre au mot que l'utilisateur lit. C'est pour
   * qui écoute que le nom du champ de fichier porte l'information.
   */
  const bloc = page.locator("fieldset").filter({ hasText: "Pièces justificatives" });
  await expect(bloc.locator("legend")).toHaveText("Pièces justificatives*");
  await expect(page.getByLabel("Pièce justificative (obligatoire)")).toBeAttached();

  await page.context().close();
});

/**
 * L'œil d'aperçu **sur la même ligne** que le téléversement (QF-56), comme au formulaire de création
 * de dossier. Il s'affichait au-dessus, sur une ligne distincte, et le lien entre le fichier choisi
 * et le bouton qui le relit se perdait.
 */
test("l'aperçu d'une pièce s'affiche sur la même ligne que le téléversement", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await page.goto("/frais/nouvelle");

  const televersement = page.getByRole("button", { name: "Choisir un fichier" }).first();
  await expect(televersement).toBeVisible();

  /*
   * **Un nom volontairement long**, parce que c'est lui qui cassait la disposition. Ma première
   * version de ce parcours téléversait « m.pdf » : la rangée tenait, le test passait, et le défaut
   * restait entier dès qu'un avocat nommait sa facture comme on la nomme. Un test qui choisit ses
   * données pour qu'elles tiennent ne mesure rien.
   */
  await page
    .locator('input[name="piece-justificative"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });
  const apercu = page.getByRole("button", { name: `Consulter - ${NOM_LONG}` });
  await expect(apercu).toBeVisible({ timeout: 30_000 });

  // Le nom est tronqué à l'écran mais lisible au survol : il cède, il ne disparaît pas.
  await expect(page.getByTitle(NOM_LONG)).toBeVisible();

  /*
   * « Sur la même ligne » se mesure, il ne se devine pas : les deux boîtes doivent se chevaucher
   * verticalement. Une assertion de texte n'aurait rien dit de la disposition, et c'est précisément
   * la disposition qui était en cause.
   */
  const boiteTeleversement = (await televersement.boundingBox())!;
  const boiteApercu = (await apercu.boundingBox())!;
  const basTeleversement = boiteTeleversement.y + boiteTeleversement.height;
  const basApercu = boiteApercu.y + boiteApercu.height;
  expect(
    Math.min(basTeleversement, basApercu) - Math.max(boiteTeleversement.y, boiteApercu.y),
    "le bouton d'aperçu n'est pas sur la même ligne que le téléversement",
  ).toBeGreaterThan(0);

  await page.context().close();
});

/**
 * La même disposition au dépôt de publication (QF-56), dans les **deux** natures.
 *
 * Le bouton de relecture y était enveloppé dans un `<div>`, qui en faisait un bloc occupant toute la
 * largeur : il s'affichait donc sous le téléversement, exactement comme au dépôt de frais.
 */
async function ouvrirDepotPublication(page: Page, nature: "compteRendu" | "document") {
  await page.goto("/publications/nouvelle");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 30_000 });
  if (nature === "document") {
    // Les deux natures sont deux choix décrits, pas deux onglets : on coche celui qu'on veut.
    await page.getByRole("radio").nth(1).check();
  }
}

/** Les deux boîtes doivent se chevaucher verticalement : « sur la même ligne » se mesure. */
async function surLaMemeLigne(page: Page, nomFichier: string) {
  const televersement = page.getByRole("button", { name: "Choisir un fichier" }).first();
  const relire = page.getByRole("button", { name: `Consulter - ${nomFichier}` });
  await expect(relire).toBeVisible({ timeout: 30_000 });

  const boiteTeleversement = (await televersement.boundingBox())!;
  const boiteRelire = (await relire.boundingBox())!;
  const chevauchement =
    Math.min(boiteTeleversement.y + boiteTeleversement.height, boiteRelire.y + boiteRelire.height) -
    Math.max(boiteTeleversement.y, boiteRelire.y);
  expect(chevauchement, "le bouton de relecture n'est pas sur la même ligne que le téléversement").toBeGreaterThan(
    0,
  );
}

test("la relecture d'une pièce de compte rendu est sur la même ligne, nom long compris", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await ouvrirDepotPublication(page, "compteRendu");

  await page
    .locator('input[name="piece-jointe"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });

  await surLaMemeLigne(page, NOM_LONG);
  // Tronqué à l'écran, lisible au survol : le nom cède, il ne disparaît pas.
  await expect(page.getByTitle(NOM_LONG)).toBeVisible();

  await page.context().close();
});

test("la relecture d'un document du dossier est sur la même ligne, nom long compris", async ({ page }) => {
  await seConnecter(page, "avocat.test");
  await ouvrirDepotPublication(page, "document");

  await page
    .locator('input[name="fichier"]')
    .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });

  await surLaMemeLigne(page, NOM_LONG);
  await expect(page.getByTitle(NOM_LONG)).toBeVisible();

  await page.context().close();
});

/**
 * Le risque que la correction introduit, et qu'il faut tenir dans les deux natures : une rangée qui
 * ne passe plus à la ligne peut déborder de l'écran si le nom ne cède pas. Le test de débordement
 * général ne couvre pas cet écran non plus - il se connecte en DJ, qui ne dépose pas de publication.
 */
test("le dépôt de publication ne déborde pas en mobile, dans les deux natures", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await seConnecter(page, "avocat.test");

  for (const [nature, champ] of [
    ["compteRendu", "piece-jointe"],
    ["document", "fichier"],
  ] as const) {
    await ouvrirDepotPublication(page, nature);
    await page
      .locator(`input[name="${champ}"]`)
      .setInputFiles({ name: NOM_LONG, mimeType: "application/pdf", buffer: PDF });
    await expect(page.getByRole("button", { name: `Consulter - ${NOM_LONG}` })).toBeVisible({
      timeout: 30_000,
    });

    const debordement = await page.evaluate(() => {
      const racine = document.documentElement;
      // Un pixel de tolérance : les arrondis de mise en page en produisent un.
      return Math.max(0, racine.scrollWidth - racine.clientWidth - 1);
    });
    expect(debordement, `la nature « ${nature} » déborde de ${debordement} px en 375 px`).toBe(0);
  }

  await page.context().close();
});

/**
 * **La correspondance du DJ parvient à l'avocat** (QF-58, signalé en recette le 2026-10-14).
 *
 * Le défaut : quand le DJ ou la DJA transmet une correspondance sur une publication, l'avocat en est
 * notifié deux fois - une alerte et une notification prestataire -, mais aucun écran ne la lui
 * montrait. Une notification qui renvoie vers une page muette dit qu'il y a quelque chose à lire
 * sans le donner.
 *
 * Le dépôt et la transmission passent par l'API : ce sont les préparatifs du parcours, et les faire
 * à l'écran n'éprouverait que des écrans déjà couverts ailleurs. **Ce qui est vérifié ici, c'est ce
 * que l'avocat voit.**
 */
test("l'avocat lit sur son espace la correspondance que le DJ lui a transmise", async ({ browser }) => {
  const reference = await creerDossierAffecteALAvocat();
  const avocat = await jeton("avocat.test");

  // Son dossier, vu de son côté : c'est la seule façon d'en obtenir l'identifiant avec son jeton.
  const mesDossiers = await json<{ content: { id: number; reference: string }[] }>(
    `/avocat/mes-dossiers?reference=${reference}`,
    avocat,
  );
  const dossierId = mesDossiers.content.find((d) => d.reference === reference)?.id;
  expect(dossierId, `le dossier ${reference} doit être visible de l'avocat`).toBeDefined();

  const corps = new FormData();
  corps.append("file", new Blob([PDF], { type: "application/pdf" }), `conclusions-${suffixe()}.pdf`);
  const depot = await fetch(
    `${API}/publications/autres?dossierId=${dossierId}&typeDocument=CONCLUSION`,
    { method: "POST", headers: { Authorization: `Bearer ${avocat}` }, body: corps },
  );
  expect(depot.status, "le dépôt de la publication doit aboutir").toBe(201);
  const publication = (await depot.json()) as { id: number };

  const message = `Merci de préciser la date de l'audience ${suffixe()}.`;
  const transmission = await appel(`/publications/${publication.id}/correspondance`, await jeton("dj.test"), {
    method: "POST",
    body: JSON.stringify({ contenu: message }),
  });
  expect(transmission.status, "la correspondance doit être transmise").toBe(201);

  const page = await pageConnectee(browser, "avocat.test");
  await page.goto("/portail");
  await expect(page.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });

  // La colonne existe, et la correspondance s'y lit - avec la signature de qui l'a transmise.
  await expect(
    page.getByRole("columnheader", { name: "Correspondance de la Direction Juridique" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(message)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Transmise par /).first()).toBeVisible();

  await page.context().close();
});

/**
 * **Ce que l'écran de l'avocat ne doit jamais montrer** (QF-58).
 *
 * Le juriste ne s'adresse jamais directement à l'avocat (Q-20, US 5.5, RG-INT-07) : il commente pour
 * le DJ/DJA, qui tranche et transmet une correspondance unique. Un commentaire interne affiché sur
 * le portail ouvrirait la délibération à celui dont elle discute - et la correction de QF-58 passait
 * à un argument près de le faire.
 */
test("le commentaire interne d'un juriste n'atteint pas le portail de l'avocat", async ({ browser }) => {
  const reference = await creerDossierAffecteALAvocat();
  const avocat = await jeton("avocat.test");

  const mesDossiers = await json<{ content: { id: number; reference: string }[] }>(
    `/avocat/mes-dossiers?reference=${reference}`,
    avocat,
  );
  const dossierId = mesDossiers.content.find((d) => d.reference === reference)?.id;

  const corps = new FormData();
  corps.append("file", new Blob([PDF], { type: "application/pdf" }), `piece-${suffixe()}.pdf`);
  const depot = await fetch(
    `${API}/publications/autres?dossierId=${dossierId}&typeDocument=PIECE`,
    { method: "POST", headers: { Authorization: `Bearer ${avocat}` }, body: corps },
  );
  expect(depot.status).toBe(201);
  const publication = (await depot.json()) as { id: number };

  const interne = `Délibération interne ${suffixe()} : à rejeter selon moi.`;
  const commentaire = await appel(`/publications/${publication.id}/commentaires`, await jeton("juriste.test"), {
    method: "POST",
    body: JSON.stringify({ contenu: interne }),
  });
  expect(commentaire.status, "le juriste doit pouvoir commenter pour le DJ/DJA").toBe(201);

  const page = await pageConnectee(browser, "avocat.test");
  await page.goto("/portail");
  await expect(page.getByRole("heading", { name: "Mon espace", level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(interne)).toHaveCount(0);

  await page.context().close();
});
