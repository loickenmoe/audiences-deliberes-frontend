/**
 * Fige le contrat d'API du backend dans `contracts/openapi.json`.
 *
 * La spécification est récupérée **manuellement**, jamais à l'exécution : `/v3/api-docs` est
 * accessible sans authentification côté backend (constat de sécurité R-08) et doit être fermé avant
 * la mise en production. Le frontend ne doit donc pas en dépendre pour fonctionner.
 *
 *   node scripts/fetch-openapi.mjs        (backend démarré sur :8080)
 *   npm run api:types                     (régénère types/api.generated.ts)
 */
import { writeFile } from "node:fs/promises";

const source = process.env.OPENAPI_URL ?? "http://localhost:8080/v3/api-docs";
const cible = "contracts/openapi.json";

try {
  const reponse = await fetch(source);
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  const spec = await reponse.json();
  await writeFile(cible, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  const nbChemins = Object.keys(spec.paths ?? {}).length;
  console.log(`✅ ${cible} écrit — ${nbChemins} chemins, version ${spec.info?.version ?? "?"}`);
} catch (erreur) {
  console.error(`❌ Impossible de récupérer ${source} : ${erreur.message}`);
  console.error("   Le backend doit être démarré (docker-compose + mvnw spring-boot:run).");
  process.exit(1);
}
