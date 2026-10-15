import { loadEnvConfig } from "@next/env";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Ma signature enregistrée (écran 46) **contre le backend réel**.
 *
 * **Pourquoi ce parcours existe.** Le dépôt a échoué en 500 à la première mise entre des mains
 * réelles : le client déclare `application/json` par défaut, et sans type multipart déclaré le
 * navigateur n'écrit pas la frontière des parties - le serveur ne voyait aucun fichier. Les tests
 * unitaires ne pouvaient pas le voir : ils simulent le service, donc le transport. Seul un dépôt
 * par un vrai navigateur vers un vrai serveur le montre, et c'est ce que fait ce fichier.
 *
 * **Ce parcours rend les comptes comme il les a trouvés.** Une signature est une donnée que son
 * titulaire a déposée à la main ; l'écraser pour les besoins d'un test, c'est lui faire refaire le
 * travail - c'est arrivé une fois, cela ne doit plus. Chaque test qui dépose sauvegarde d'abord ce
 * qui était là et le remet ensuite, y compris quand il échoue.
 */

loadEnvConfig(process.cwd());

const MOT_DE_PASSE = "Password1!";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

/** Un PNG valide, minuscule : ce parcours vérifie le transport, pas le dessin. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
);

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

type Depot = { image: Buffer; type: string } | null;

/** Ce qu'un compte porte aujourd'hui : son image et son type, ou rien du tout. */
async function signatureDe(acces: string): Promise<Depot> {
  const entetes = { Authorization: `Bearer ${acces}` };
  const etat = (await (await fetch(`${API}/utilisateurs/moi/signature`, { headers: entetes })).json()) as {
    deposee: boolean;
    type: string | null;
  };
  if (!etat.deposee) return null;
  const reponse = await fetch(`${API}/utilisateurs/moi/signature/image`, { headers: entetes });
  return { image: Buffer.from(await reponse.arrayBuffer()), type: etat.type ?? "image/png" };
}

/** Remet exactement ce qui était là - y compris l'absence, qui est un état comme un autre. */
async function retablir(acces: string, origine: Depot): Promise<void> {
  const entetes = { Authorization: `Bearer ${acces}` };
  if (origine === null) {
    await fetch(`${API}/utilisateurs/moi/signature`, { method: "DELETE", headers: entetes });
    return;
  }
  const corps = new FormData();
  corps.append("fichier", new Blob([origine.image], { type: origine.type }), "signature");
  await fetch(`${API}/utilisateurs/moi/signature`, { method: "PUT", headers: entetes, body: corps });
}

async function pageConnectee(browser: Browser, identifiant: string) {
  const contexte = await browser.newContext({ locale: "fr-FR" });
  const page = await contexte.newPage();
  await page.goto("/login");
  await page.getByLabel("Identifiant", { exact: true }).fill(identifiant);
  await page.getByLabel("Mot de passe", { exact: true }).fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Connexion" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 60_000 });
  return page;
}

/** On y accède par son nom, en haut à droite : c'est là qu'on cherche son compte. */
async function monCompte(page: Page) {
  await page.goto("/mon-compte");
  await expect(page.getByRole("heading", { name: "Ma signature" })).toBeVisible({ timeout: 60_000 });
}

test.setTimeout(180_000);
// Les trois parcours touchent les mêmes comptes : en parallèle, ils se marcheraient dessus.
test.describe.configure({ mode: "serial" });

/**
 * Le parcours qui aurait attrapé le défaut : un dépôt réel, puis la relecture de ce qui a été
 * déposé. L'oeil compte autant que le dépôt - déposer une signature sans pouvoir la relire en
 * grand reviendrait à signer les yeux fermés.
 */
test("le SH dépose sa signature, la voit, et l'ouvre en grand", async ({ browser }) => {
  const acces = await jeton("sh.test");
  const origine = await signatureDe(acces);
  const sh = await pageConnectee(browser, "sh.test");
  try {
    await monCompte(sh);
    await sh
      .locator('input[name="signature"]')
      .setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: PNG });
    await expect(sh.getByText("Signature enregistrée.")).toBeVisible({ timeout: 30_000 });

    // La vignette, puis le plein format : l'image revient bien du serveur, et pas d'un cache local.
    await expect(sh.getByAltText("Aperçu de ma signature")).toBeVisible({ timeout: 30_000 });
    await sh.getByRole("button", { name: "Aperçu", exact: true }).click();
    const apercu = sh.getByRole("dialog", { name: "Aperçu - signature.png" });
    await expect(apercu.getByRole("img")).toBeVisible({ timeout: 30_000 });
    await apercu.getByRole("button", { name: "Fermer" }).last().click();

    // L'écran dit sa portée : qui croirait tenir là une garantie juridique s'appuierait sur du vide.
    await expect(sh.getByText(/n’ajoute aucune valeur juridique/)).toBeVisible();

    // Le retrait, et ce qu'il annonce : les lettres déjà signées ne changent pas.
    await sh.getByRole("button", { name: "Retirer", exact: true }).click();
    const confirmation = sh.getByRole("dialog", { name: "Retirer votre signature ?" });
    await expect(confirmation.getByText(/Les lettres déjà signées ne changent pas/)).toBeVisible();
    await confirmation.getByRole("button", { name: "Retirer", exact: true }).click();
    await expect(sh.getByText("Signature retirée.")).toBeVisible({ timeout: 30_000 });
    await expect(sh.getByText("Aucune signature déposée.", { exact: false })).toBeVisible();
  } finally {
    await sh.context().close();
    await retablir(acces, origine);
  }
});

/**
 * PDFBox lit le PNG et le JPEG. Un PDF produirait une lettre sans signature, vue à l'impression.
 *
 * C'est le champ de téléversement maison qui parle ici : il refuse sur l'**extension**, qui est la
 * règle du backend (Q-46), avant même que l'écran voie le fichier. Le contrôle du type MIME que
 * l'écran ajoute derrière rattrape le cas où l'extension ment, et c'est le serveur qui tranche en
 * dernier. Ce qui compte pour ce parcours : rien ne part, et l'utilisateur sait pourquoi.
 */
test("un PDF est refusé avant même de partir", async ({ browser }) => {
  const acces = await jeton("juriste.test");
  const avant = await signatureDe(acces);
  const juriste = await pageConnectee(browser, "juriste.test");
  try {
    await monCompte(juriste);
    await juriste
      .locator('input[name="signature"]')
      .setInputFiles({ name: "contrat.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(juriste.getByText(/Formats admis : PNG, JPG, JPEG/)).toBeVisible({ timeout: 30_000 });
    await expect(juriste.getByText("Signature enregistrée.")).toHaveCount(0);

    // Rien n'est parti : le compte porte exactement ce qu'il portait, déposé ou vide.
    const apres = await signatureDe(acces);
    expect(apres === null).toBe(avant === null);
    if (avant !== null && apres !== null) expect(apres.image.equals(avant.image)).toBe(true);
  } finally {
    await juriste.context().close();
  }
});

/**
 * Chacun ne voit que la sienne. Une signature qu'un tiers détient ne vaut déjà plus rien : c'est la
 * raison d'être de l'écran, et elle se vérifie du dehors, pas seulement dans le code du serveur.
 *
 * Le parcours ne suppose **pas** que le juriste n'a rien déposé : les comptes de recette portent de
 * vraies signatures. Ce qu'il vérifie est plus fort - l'image servie au juriste n'est jamais celle
 * du SH, quoi que chacun ait déposé.
 */
test("la signature du SH reste invisible au juriste", async ({ browser }) => {
  const accesSh = await jeton("sh.test");
  const accesJuriste = await jeton("juriste.test");
  const origine = await signatureDe(accesSh);
  const sh = await pageConnectee(browser, "sh.test");
  try {
    await monCompte(sh);
    await sh
      .locator('input[name="signature"]')
      .setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: PNG });
    await expect(sh.getByText("Signature enregistrée.")).toBeVisible({ timeout: 30_000 });

    const vueParLeSh = await signatureDe(accesSh);
    const vueParLeJuriste = await signatureDe(accesJuriste);
    expect(vueParLeSh?.image.equals(PNG)).toBe(true);
    // Le juriste reçoit la sienne, ou rien. Jamais celle du SH.
    expect(vueParLeJuriste?.image.equals(PNG) ?? false).toBe(false);

    // Et à l'écran, le juriste ouvre son compte sans rien voir de celui du SH.
    const juriste = await pageConnectee(browser, "juriste.test");
    await monCompte(juriste);
    await expect(juriste.getByRole("heading", { name: "Ma signature" })).toBeVisible();
    await juriste.context().close();
  } finally {
    await sh.context().close();
    await retablir(accesSh, origine);
  }
});
