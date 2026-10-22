/**
 * Snapshots the backend API contract into `contracts/openapi.json`.
 *
 * The spec is fetched manually, never at runtime: `/v3/api-docs` is unauthenticated on the backend
 * and must be closed before production, so the frontend must not depend on it.
 *
 *   node scripts/fetch-openapi.mjs        (backend running on :8080)
 *   npm run api:types                     (regenerates types/api.generated.ts)
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
