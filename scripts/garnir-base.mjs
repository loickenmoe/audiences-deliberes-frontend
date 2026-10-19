/**
 * Seeds an empty database with a set of valid cases (every case has parties and an agency code),
 * capped at 50 cases. The default of 40 leaves room for cases created during manual testing.
 *
 * It invents no business rule: case types and agencies come from the reference data, and clients
 * and lawyers are created through the real endpoints with real tokens. Party names are explicitly
 * fictitious so nobody mistakes them for real counterparties.
 *
 *   node scripts/garnir-base.mjs           (backend running, database empty or nearly so)
 *   CIBLE=20 node scripts/garnir-base.mjs  (for a smaller set)
 */
import { readFile } from "node:fs/promises";

const PLAFOND = 50;
const CIBLE = Math.min(Number(process.env.CIBLE ?? 40), PLAFOND);

/*
 * The env file is read here and nothing from it is printed: it holds the Keycloak client secret.
 * `.env.local` is authoritative (the realm export may have been regenerated). `@next/env` cannot be
 * used: it is a CommonJS module, which a named import from an ESM script rejects.
 */
await chargerEnv(".env.local");

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
const issuer = process.env.KEYCLOAK_ISSUER ?? "http://localhost:8081/realms/audiences-realm";
const clientId = process.env.KEYCLOAK_CLIENT_ID ?? "audiences-api";
const secret = process.env.KEYCLOAK_CLIENT_SECRET;
if (!secret) {
  throw new Error("KEYCLOAK_CLIENT_SECRET absent : vérifiez .env.local (cf. env.template).");
}

async function chargerEnv(chemin) {
  let contenu;
  try {
    contenu = await readFile(chemin, "utf8");
  } catch {
    // Missing file: the shell environment may suffice; the secret check above reports otherwise.
    return;
  }
  for (const ligne of contenu.split(/\r?\n/)) {
    const correspondance = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne);
    if (!correspondance) continue;
    const [, nom, brut] = correspondance;
    // Values already set in the shell win: never override an explicit setting.
    if (process.env[nom] !== undefined) continue;
    process.env[nom] = brut.trim().replace(/^["']|["']$/g, "");
  }
}

async function jeton(identifiant) {
  const reponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: clientId,
      client_secret: secret,
      username: identifiant,
      password: "Password1!",
      scope: "openid",
    }),
  }).catch(() => {
    throw new Error(`Keycloak injoignable (${issuer}) : démarrez les conteneurs.`);
  });
  if (!reponse.ok) throw new Error(`Connexion refusée pour ${identifiant} (${reponse.status}).`);
  return (await reponse.json()).access_token;
}

async function appel(chemin, acces, init = {}) {
  const reponse = await fetch(`${api}${chemin}`, {
    ...init,
    headers: { Authorization: `Bearer ${acces}`, "Content-Type": "application/json", ...init.headers },
  }).catch(() => {
    throw new Error(`Backend injoignable (${api}) : démarrez l'application.`);
  });
  if (reponse.status === 409) return null;
  if (!reponse.ok) {
    throw new Error(`${init.method ?? "GET"} ${chemin} → ${reponse.status} ${await reponse.text()}`);
  }
  return reponse.status === 204 ? null : reponse.json();
}

/** Deliberately fictitious counterparty names. */
const DEFENDEURS = [
  ["Débiteur principal"],
  ["Débiteur principal", "Caution solidaire"],
  ["Société débitrice", "Gérant caution", "Co-emprunteur"],
  ["Tiers saisi"],
];
const DEMANDEURS = [
  ["AFRILAND FIRST BANK"],
  ["AFRILAND FIRST BANK", "Agence de recouvrement mandatée"],
];
const JURIDICTIONS = [
  "TGI Douala",
  "TPI Yaoundé",
  "Cour d'appel du Littoral",
  "TGI Bafoussam",
  "TPI Garoua",
];

const juriste = await jeton("juriste.test");
const dj = await jeton("dj.test");

/*
 * Lazy provisioning: an internal user only exists in the application after a call that resolves
 * the current user. `GET /utilisateurs` only reads the directory and provisions nobody, so the
 * notification bell endpoint is used instead.
 */
await appel("/alertes/mes-notifications?size=1", juriste);
await appel("/alertes/mes-notifications?size=1", dj);

const dejaLa = (await appel("/dossiers?size=1", juriste))?.totalElements ?? 0;
if (dejaLa >= CIBLE) {
  console.log(`La base porte déjà ${dejaLa} dossiers : rien à créer (cible ${CIBLE}).`);
  process.exit(0);
}

const CLIENTS = [
  "SARL Bâtir Ensemble",
  "Établissements Mbarga et Fils",
  "Société Camerounaise de Transit",
  "Coopérative agricole de l'Ouest",
  "Entreprise Générale du Littoral",
  "Groupe Scolaire Les Palmiers",
];
let clients = (await appel("/clients?size=200", juriste))?.content ?? [];
for (const nom of CLIENTS) {
  if (clients.some((client) => client.nom === nom)) continue;
  await appel("/clients", juriste, { method: "POST", body: JSON.stringify({ nom }) });
}
clients = (await appel("/clients?size=200", juriste))?.content ?? [];
if (clients.length === 0) throw new Error("Aucun client : la création a échoué.");

/*
 * A single lawyer on purpose: RG-INT-01 requires one application account per lawyer, and the dev
 * realm declares only `avocat.test`. Keycloak identifiers come from the bank directory and must not
 * be invented, so every case is assigned to the same lawyer.
 */
const AVOCATS = [{ nom: "Me Claire Avocat", compteKeycloak: "avocat.test" }];
let avocats = (await appel("/intervenants?type=AVOCAT&size=200", juriste))?.content ?? [];
for (const fiche of AVOCATS) {
  if (avocats.some((avocat) => avocat.nom === fiche.nom)) continue;
  // Only DJ and DJA may create a stakeholder.
  await appel("/intervenants", dj, {
    method: "POST",
    body: JSON.stringify({ type: "AVOCAT", ...fiche }),
  });
}
avocats = (await appel("/intervenants?type=AVOCAT&size=200", juriste))?.content ?? [];
if (avocats.length === 0) throw new Error("Aucun avocat : la création a échoué.");

const juristes = (await appel("/utilisateurs?profil=JURISTE", juriste)) ?? [];
if (juristes.length === 0) throw new Error("Aucun juriste dans l'annuaire : connectez-vous une fois.");

const natures = (await appel("/referentiels/natures-dossier", juriste)) ?? [];
if (natures.length === 0) throw new Error("Référentiel des natures vide : migrations appliquées ?");

// Agencies come from the reference data: no code is hard-coded here.
const agences = (await appel("/referentiels/agences?size=200&actifSeulement=true", juriste))?.content ?? [];
if (agences.length === 0) throw new Error("Référentiel des agences vide : la migration V42 a-t-elle tourné ?");

const aCreer = CIBLE - dejaLa;
const types = (await appel("/referentiels/types-client-sensible", juriste)) ?? [];
const crees = [];

for (let index = 0; index < aCreer; index += 1) {
  const nature = natures[index % natures.length];
  const agence = agences[index % agences.length];
  const client = clients[index % clients.length];
  const avocat = avocats[index % avocats.length];
  // One case in seven needs special diligence: enough to exercise the DJ/DJA workflow while
  // keeping the arbitration queue readable.
  const diligence = index % 7 === 0 && types.length > 0;
  const recouvrement = nature.categorie === "RECOUVREMENT";

  const corps = {
    nature: nature.libelle,
    juridictionSaisie: JURIDICTIONS[index % JURIDICTIONS.length],
    clientId: client.id,
    risqueEncouru: 1_500_000 + (index % 12) * 2_500_000,
    parties: {
      demandeurs: DEMANDEURS[index % DEMANDEURS.length],
      defendeurs: DEFENDEURS[index % DEFENDEURS.length],
    },
    codeAgenceOrigine: agence.code,
    // One case in three is handled by an agency other than its originating one.
    codeAgenceContentieuse: index % 3 === 0 ? agences[(index + 5) % agences.length].code : undefined,
    dossierCreditOrigine: recouvrement ? `CRD-${1000 + index}` : undefined,
    pvTransfert: recouvrement ? `PV-${1000 + index}` : undefined,
    incidentCompteReference: recouvrement ? undefined : `INC-${1000 + index}`,
    elementsJustificatifs: recouvrement ? undefined : "Correspondances et relevés joints au dossier.",
    estSensible: diligence,
    seuilMontant: diligence ? 60_000_000 : undefined,
    typeClientSensible: diligence ? types[0].code : undefined,
    juristesAffectes: [juristes[index % juristes.length].id],
    avocatsAffectes: [avocat.id],
  };

  const dossier = await appel("/dossiers", juriste, { method: "POST", body: JSON.stringify(corps) });
  crees.push(dossier);

  // Two cases in three are opened: no hearing can be scheduled on a step still in the
  // opening status.
  if (index % 3 !== 2) {
    const fiche = await appel(`/dossiers/${dossier.id}`, juriste);
    const etape = fiche.etapes[0];
    await appel(`/dossiers/${dossier.id}/etapes/${etape.id}/statut`, juriste, {
      method: "PATCH",
      body: JSON.stringify({ nouveauStatut: "EN_COURS" }),
    });
  }
}

const total = (await appel("/dossiers?size=1", juriste))?.totalElements ?? 0;
if (total > PLAFOND) {
  throw new Error(`La base porte ${total} dossiers : le plafond demandé est ${PLAFOND}.`);
}

// Every created case must carry its parties and a valid agency.
for (const dossier of crees) {
  const fiche = await appel(`/dossiers/${dossier.id}`, juriste);
  const parties = fiche.parties ?? {};
  if (!(parties.demandeurs?.length > 0) || !(parties.defendeurs?.length > 0)) {
    throw new Error(`${fiche.reference} est sans parties : la reprise a échoué.`);
  }
  if (!fiche.codeAgenceOrigine) {
    throw new Error(`${fiche.reference} est sans agence d'origine : la reprise a échoué.`);
  }
  if (!agences.some((agence) => agence.code === fiche.codeAgenceOrigine)) {
    throw new Error(`${fiche.reference} porte un code d'agence hors référentiel.`);
  }
}

console.log(
  `✅ ${crees.length} dossiers créés, ${total} au total (plafond ${PLAFOND}).\n` +
    `   ${clients.length} clients, ${avocats.length} avocat${avocats.length > 1 ? "s" : ""}, ` +
    `${agences.length} agences au référentiel.\n` +
    `   Tous portent au moins un demandeur, un défendeur et une agence du référentiel.`,
);
