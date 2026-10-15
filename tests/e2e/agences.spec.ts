import { expect, test, type Page } from "@playwright/test";

/**
 * Le référentiel des agences, écran 44 (métier, 2026-10-03, observation 2).
 *
 * **Ce que ces parcours protègent.** Les deux codes d'agence d'un dossier étaient du texte libre :
 * sur les 341 dossiers de recette, un seul en portait un, et il ne désignait aucune agence. Trois
 * règles ferment désormais la saisie, et chacune casserait en silence : le **code ne se modifie
 * pas**, une agence se **ferme et se rouvre** au lieu d'être supprimée, et la **ville est
 * obligatoire** parce que deux agences portent le même nom.
 *
 * **La liste est paginée, 25 agences par page, triée par code.** Une agence qu'on vient de créer
 * n'est donc **pas** sur la page affichée : il faut la chercher. C'est ce que fait `chercher()`, et
 * c'est le premier geste après chaque arrivée sur l'écran - sans quoi le parcours attendrait une
 * ligne qui existe en base mais pas devant lui.
 *
 * **Les agences créées ici ne sont pas nettoyées, et c'est voulu** : la suppression n'existe pas.
 * Chacune est donc laissée **fermée** en fin de parcours, pour qu'elle ne se propose plus à la
 * saisie des autres parcours. Son code porte un suffixe aléatoire, pour qu'une exécution répétée
 * ne se heurte pas à son propre doublon.
 */
const MOT_DE_PASSE = "Password1!";

async function seConnecter(page: Page, identifiant: string) {
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
}

/**
 * Un code libre, hors de toute plage réelle.
 *
 * **Il doit être unique à travers les exécutions**, et non seulement dans celle-ci : une agence ne
 * se supprime pas - elle se ferme - donc chaque passage de la suite laisse les siennes derrière
 * lui. Un tirage dans `009xx` offrait quatre-vingt-dix codes et en consommait quatre par passage :
 * les collisions sont devenues la norme, et la création refusée laissait la modale ouverte.
 *
 * L'horodatage à la milliseconde tient dans les vingt caractères de la colonne et ne se répétera
 * pas.
 */
function codeDeTest() {
  return `9${Date.now() % 1_000_000_000}`;
}

/** La ligne de l'agence dans le tableau, atteinte par son code. */
function ligne(page: Page, code: string) {
  return page.getByRole("row").filter({ has: page.getByRole("cell", { name: code, exact: true }) });
}

/**
 * Amène l'agence sous les yeux. La recherche est servie par le backend : elle ramène l'agence
 * quelle que soit la page où son code la place.
 */
async function chercher(page: Page, code: string) {
  await page.getByLabel("Rechercher une agence", { exact: true }).fill(code);
  await expect(ligne(page, code)).toBeVisible({ timeout: 30_000 });
}

/**
 * Ferme l'agence depuis sa ligne, confirmation comprise.
 *
 * Le bouton du dialogue porte **le même libellé** que celui de la ligne - c'est
 * `libelleConfirmation` qui le veut, pour que l'utilisateur confirme l'action qu'il a nommée. Il
 * faut donc le viser **dans le dialogue**, sans quoi le sélecteur trouve deux boutons.
 */
async function fermerDepuisLaLigne(page: Page, code: string) {
  await ligne(page, code).getByRole("button", { name: /Désactiver/ }).click();
  const dialogue = page.getByRole("dialog");
  await dialogue.getByRole("button", { name: "Désactiver", exact: true }).click();
  await expect(dialogue).toBeHidden({ timeout: 30_000 });
  await expect(ligne(page, code).getByText("Fermée")).toBeVisible({ timeout: 30_000 });
}

/** Crée une agence depuis l'écran et renvoie son code. */
async function creerAgence(page: Page, nom: string) {
  const code = codeDeTest();
  await page.goto("/admin/agences");
  await page.getByRole("button", { name: "Nouvelle agence" }).click();
  await page.getByLabel("Code", { exact: true }).fill(code);
  await page.getByLabel("Nom", { exact: true }).fill(nom);
  await page.getByLabel("Ville", { exact: true }).fill("Douala");
  await page.getByLabel("Adresse", { exact: true }).fill("Rue de la recette");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  /*
   * Attendre que le dialogue **se referme**, et non qu'un bouton de l'écran soit visible : un
   * `<dialog>` modal rend le reste de la page **inerte**, et la recherche faite trop tôt n'y
   * entrait pas - le tableau restait sur sa première page, où la nouvelle agence n'est pas.
   */
  await expect(page.getByRole("dialog", { name: "Créer une agence" })).toBeHidden({ timeout: 30_000 });
  await chercher(page, code);
  return code;
}

test("le DJ crée une agence, que la saisie propose aussitôt", async ({ page }) => {
  await seConnecter(page, "dj.test");
  const nom = `AGENCE E2E ${Date.now() % 100000}`;
  const code = await creerAgence(page, nom);

  await expect(ligne(page, code).getByText("Ouverte")).toBeVisible();

  // La création d'un dossier doit la proposer sans rechargement de page : même référentiel.
  await page.goto("/dossiers/nouveau");
  const champ = page.getByRole("combobox", { name: /Agence d.origine/ });
  await champ.click();
  await champ.fill(code);
  const liste = page.getByRole("listbox", { name: /Agence d.origine/ });
  // La ligne porte le code, le mot « Agence » et la ville (métier, 2026-10-05 et 2026-10-06).
  await expect(liste.getByRole("option", { name: new RegExp(`${code} · Agence ${nom} · Douala`) }))
    .toBeVisible({ timeout: 30_000 });

  // Laissée fermée : elle ne doit pas encombrer la saisie des autres parcours.
  await page.goto("/admin/agences");
  await chercher(page, code);
  await fermerDepuisLaLigne(page, code);
});

test("la ville est obligatoire, et un code déjà porté est refusé", async ({ page }) => {
  await seConnecter(page, "dj.test");
  await page.goto("/admin/agences");
  await page.getByRole("button", { name: "Nouvelle agence" }).click();

  await page.getByLabel("Code", { exact: true }).fill(codeDeTest());
  await page.getByLabel("Nom", { exact: true }).fill("SANS VILLE");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  // Deux agences peuvent porter le même nom : sans ville, rien ne les distingue à la saisie.
  await expect(page.getByText("Ce champ est obligatoire.").first()).toBeVisible();

  // `00002` est Bonanjo, chargée par la migration V42 : le doublon se signale sur le champ Code.
  await page.getByLabel("Code", { exact: true }).fill("00002");
  await page.getByLabel("Ville", { exact: true }).fill("Douala");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText(/porte déjà le code 00002/)).toBeVisible({ timeout: 30_000 });
});

test("une agence se ferme puis se rouvre, et garde son code", async ({ page }) => {
  await seConnecter(page, "dj.test");
  const nom = `AGENCE CYCLE ${Date.now() % 100000}`;
  const code = await creerAgence(page, nom);

  await fermerDepuisLaLigne(page, code);

  // Fermée, elle quitte la saisie...
  await page.goto("/dossiers/nouveau");
  const champ = page.getByRole("combobox", { name: /Agence d.origine/ });
  await champ.click();
  await champ.fill(code);
  const liste = page.getByRole("listbox", { name: /Agence d.origine/ });
  await expect(liste.getByText("Aucun résultat")).toBeVisible({ timeout: 30_000 });

  // ...mais elle se rouvre, sans confirmation : le geste est bénin (métier, 2026-10-06).
  await page.goto("/admin/agences");
  await chercher(page, code);
  await ligne(page, code).getByRole("button", { name: /Réactiver/ }).click();
  await expect(ligne(page, code).getByText("Ouverte")).toBeVisible({ timeout: 30_000 });
  // Le code n'a pas bougé : c'est la même agence qui rouvre.
  await expect(ligne(page, code).getByRole("cell", { name: code, exact: true })).toBeVisible();

  // Reposée en position fermée pour les parcours suivants.
  await fermerDepuisLaLigne(page, code);
});

test("le code d'une agence ne se modifie pas", async ({ page }) => {
  await seConnecter(page, "dj.test");
  const code = await creerAgence(page, `AGENCE CODE ${Date.now() % 100000}`);

  await ligne(page, code).getByRole("button", { name: /Modifier/ }).click();
  /*
   * Viser **dans la modale** : un `<dialog>` fermé reste dans le DOM, celle de création est donc
   * encore là avec son propre champ « Code ». C'est la raison d'être des identifiants par instance
   * côté composant, et le sélecteur doit en tenir compte lui aussi.
   */
  const modale = page.getByRole("dialog", { name: "Modifier l’agence" });
  // Les dossiers portent le code en clair : le modifier les détacherait de leur agence.
  await expect(modale.getByLabel("Code", { exact: true })).toBeDisabled();
  await expect(modale.getByText(/ne se modifie pas/).first()).toBeVisible();

  await modale.getByLabel("Ville", { exact: true }).fill("Yaoundé");
  await modale.getByRole("button", { name: "Enregistrer" }).click();
  await expect(modale).toBeHidden({ timeout: 30_000 });
  await expect(ligne(page, code).getByRole("cell", { name: "Yaoundé", exact: true }))
    .toBeVisible({ timeout: 30_000 });

  await fermerDepuisLaLigne(page, code);
});

test("la recherche porte sur le code et sur le nom, sans distinction de casse", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/admin/agences");

  await page.getByLabel("Rechercher une agence", { exact: true }).fill("bona");
  // Bonanjo, Bonabéri, Bonamoussadi, Bonapriso : quatre agences du référentiel (V42), trouvées par
  // un fragment en minuscules alors que les noms sont en capitales.
  await expect(page.getByRole("cell", { name: "BONANJO", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "BONAPRISO", exact: true })).toBeVisible();

  // La recherche porte aussi sur le code, pour qui le connaît par cœur.
  await page.getByLabel("Rechercher une agence", { exact: true }).fill("00002");
  await expect(page.getByRole("cell", { name: "BONANJO", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "BONAPRISO", exact: true })).toHaveCount(0);
});

test("un juriste lit le référentiel des agences mais ne l'écrit pas", async ({ page }) => {
  await seConnecter(page, "juriste.test");
  await page.goto("/admin/agences");

  await expect(page.getByRole("heading", { name: "Agences", level: 1 })).toBeVisible();
  // La lecture explique ce que propose le formulaire ; la tenue est au DJ et à la DJA.
  await expect(page.getByRole("button", { name: "Nouvelle agence" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Modifier/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Désactiver/ })).toHaveCount(0);
});

test("l'écran des agences est traduit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "en", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill("dj.test");
  await page.getByLabel("Password", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });

  await page.goto("/admin/agences");
  await expect(page.getByRole("heading", { name: "Branches", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "New branch" })).toBeVisible();
  await expect(page.getByLabel("Search for a branch", { exact: true })).toBeVisible();

  // Le mot qui précède le nom est traduit lui aussi (métier, 2026-10-06).
  await page.goto("/dossiers/nouveau");
  const champ = page.getByRole("combobox", { name: /Originating branch/ });
  await champ.click();
  await champ.fill("00002");
  const liste = page.getByRole("listbox", { name: /Originating branch/ });
  await expect(liste.getByRole("option", { name: /00002 · Branch BONANJO · Douala/ }))
    .toBeVisible({ timeout: 30_000 });
});
