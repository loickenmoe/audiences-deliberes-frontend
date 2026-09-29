import { loadEnvConfig } from "@next/env";

/**
 * L'avocat du référentiel **rattaché au compte `avocat.test`** — lu, jamais supposé.
 *
 * <b>Le défaut que ce module corrige.</b> Les parcours codaient le nom « Me Claire Avocat » en dur
 * dans leurs sélecteurs, parce que c'est celui que la préparation donne à la fiche qu'elle crée.
 * Or la préparation ne crée cette fiche que si **aucune** n'est rattachée à `avocat.test` : le jour
 * où un DJ en a inscrit une sous un autre nom — ce qui est son métier —, neuf parcours ont échoué
 * d'un coup, sans qu'aucune ligne de l'application soit en cause.
 *
 * Ce que le socle garantit est qu'**un** avocat est rattaché au compte de test, pas son nom. C'est
 * donc cela qu'il faut lire. Le nom appartient aux données, et les données changent.
 *
 * Le résultat est mis en cache pour la durée du processus : chaque parcours le demande, et le
 * référentiel ne change pas d'un test à l'autre.
 */

let cache: Promise<AvocatDeTest> | null = null;

export interface AvocatDeTest {
  id: number;
  nom: string;
}

async function lire(): Promise<AvocatDeTest> {
  loadEnvConfig(process.cwd());

  const issuer = process.env.KEYCLOAK_ISSUER;
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!issuer || !api) throw new Error("KEYCLOAK_ISSUER et NEXT_PUBLIC_API_URL sont requis");

  const reponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: process.env.KEYCLOAK_CLIENT_ID ?? "",
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
      username: "juriste.test",
      password: "Password1!",
      scope: "openid",
    }),
  });
  if (!reponse.ok) throw new Error(`Connexion refusée pour juriste.test (${reponse.status})`);
  const { access_token: acces } = (await reponse.json()) as { access_token: string };

  const page = (await (
    await fetch(`${api}/intervenants?type=AVOCAT&size=200`, { headers: { Authorization: `Bearer ${acces}` } })
  ).json()) as { content: { id: number; nom: string; compteKeycloak: string | null }[] };

  const rattache = page.content.find((avocat) => avocat.compteKeycloak === "avocat.test");
  if (!rattache) {
    throw new Error(
      "Aucun avocat du référentiel n'est rattaché au compte `avocat.test`. La préparation globale "
        + "(tests/e2e/preparation.ts) doit en créer un : vérifiez que le backend répond.",
    );
  }
  return { id: rattache.id, nom: rattache.nom };
}

/** L'avocat rattaché à `avocat.test`, tel qu'il est **aujourd'hui** dans le référentiel. */
export function avocatDeTest(): Promise<AvocatDeTest> {
  cache ??= lire();
  return cache;
}
