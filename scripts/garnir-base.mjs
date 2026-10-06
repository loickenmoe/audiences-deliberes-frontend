/**
 * Garnit une base vide d'un jeu de dossiers **conformes aux règles du 2026-10-05**.
 *
 * **Pourquoi ce script existe.** La base de recette portait 341 dossiers, dont 340 sans parties au
 * procès et 340 sans code d'agence : des données nées avant que ces champs soient obligatoires. Les
 * rendre obligatoires sans vider la base aurait laissé 340 dossiers impossibles à modifier sans
 * ressaisie. Décision du porteur du projet (2026-10-05) : vider (`docker compose down -v`) et
 * regarnir d'**au plus 50 dossiers** conformes.
 *
 * **Quarante, et non cinquante.** La campagne de recette en crée elle-même une dizaine : le jeu de
 * départ laisse la place, pour que le total reste sous la cinquantaine demandée.
 *
 * **Il ne fabrique aucune règle métier.** Les natures viennent du référentiel, les agences du
 * référentiel, les clients et avocats sont créés par les endpoints réels avec les jetons réels. Les
 * noms de parties sont des noms de fiction explicites - « Débiteur », « Caution » - pour qu'aucun
 * lecteur ne les prenne pour de vraies contreparties.
 *
 *   node scripts/garnir-base.mjs           (backend démarré, base vide ou presque)
 *   CIBLE=20 node scripts/garnir-base.mjs  (pour un jeu plus court)
 */
import { readFile } from "node:fs/promises";

const PLAFOND = 50;
const CIBLE = Math.min(Number(process.env.CIBLE ?? 40), PLAFOND);

/*
 * Mêmes défauts que `smoke-backend.mjs`, et même repli pour le secret : il est lu dans l'export du
 * realm plutôt qu'exigé dans l'environnement. `@next/env` n'est pas utilisable ici - c'est un module
 * CommonJS, que l'import nommé d'un script ESM refuse.
 */
/*
 * Le fichier d'environnement est lu ici, et **rien n'en est affiché** : il porte le secret du client
 * Keycloak. L'export du realm en porte un aussi, mais il peut avoir été régénéré depuis :
 * `.env.local` fait foi, c'est lui que les parcours e2e emploient. `@next/env` n'est pas utilisable
 * ici - module CommonJS, que l'import nommé d'un script ESM refuse.
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
    // Absent : l'environnement du shell peut suffire. Le contrôle ci-dessus le dira.
    return;
  }
  for (const ligne of contenu.split(/\r?\n/)) {
    const correspondance = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne);
    if (!correspondance) continue;
    const [, nom, brut] = correspondance;
    // Les valeurs déjà posées dans le shell gagnent : on n'écrase pas un réglage explicite.
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

/** Les contreparties : des noms de fiction, assumés comme tels. */
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
 * Provisionnement paresseux (QF-16) : un utilisateur interne n'existe dans l'application qu'après
 * sa première connexion. Il faut pour cela un endpoint qui **résolve l'utilisateur courant** -
 * `GET /utilisateurs` se contente de lire l'annuaire et ne provisionne personne. C'est l'appel que
 * fait la cloche des notifications à l'ouverture de l'application.
 */
await appel("/alertes/mes-notifications?size=1", juriste);
await appel("/alertes/mes-notifications?size=1", dj);

const dejaLa = (await appel("/dossiers?size=1", juriste))?.totalElements ?? 0;
if (dejaLa >= CIBLE) {
  console.log(`La base porte déjà ${dejaLa} dossiers : rien à créer (cible ${CIBLE}).`);
  process.exit(0);
}

// ---------------------------------------------------------------- le socle

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
 * **Un seul avocat**, et c'est voulu. RG-INT-01 exige qu'un avocat porte un compte applicatif
 * unique, et le realm de développement n'en déclare qu'un : `avocat.test`. Inventer des
 * identifiants Keycloak n'est pas permis - ils viennent de l'annuaire de la banque. Les dossiers
 * seront donc tous confiés au même avocat, ce qui suffit à garnir la base.
 */
const AVOCATS = [{ nom: "Me Claire Avocat", compteKeycloak: "avocat.test" }];
let avocats = (await appel("/intervenants?type=AVOCAT&size=200", juriste))?.content ?? [];
for (const fiche of AVOCATS) {
  if (avocats.some((avocat) => avocat.nom === fiche.nom)) continue;
  // La création d'un intervenant est réservée au DJ et à la DJA (#61).
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

// Les agences viennent du référentiel : aucun code n'est écrit en dur ici.
const agences = (await appel("/referentiels/agences?size=200&actifSeulement=true", juriste))?.content ?? [];
if (agences.length === 0) throw new Error("Référentiel des agences vide : la migration V42 a-t-elle tourné ?");

// ---------------------------------------------------------------- les dossiers

const aCreer = CIBLE - dejaLa;
const types = (await appel("/referentiels/types-client-sensible", juriste)) ?? [];
const crees = [];

for (let index = 0; index < aCreer; index += 1) {
  const nature = natures[index % natures.length];
  const agence = agences[index % agences.length];
  const client = clients[index % clients.length];
  const avocat = avocats[index % avocats.length];
  // Un dossier sur sept est à diligence particulière : assez pour que le circuit DJ/DJA ait de la
  // matière, assez peu pour que la file d'arbitrage reste lisible.
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
    // Un dossier sur trois est suivi ailleurs qu'à l'agence où il est né.
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

  /*
   * Deux dossiers sur trois sont ouverts : une base dont toutes les étapes sont au statut
   * « Ouverture » ne permet de planifier aucune audience, et donne une fausse image du module.
   */
  if (index % 3 !== 2) {
    const fiche = await appel(`/dossiers/${dossier.id}`, juriste);
    const etape = fiche.etapes[0];
    await appel(`/dossiers/${dossier.id}/etapes/${etape.id}/statut`, juriste, {
      method: "PATCH",
      body: JSON.stringify({ nouveauStatut: "EN_COURS" }),
    });
  }
}

// ---------------------------------------------------------------- les vérifications

const total = (await appel("/dossiers?size=1", juriste))?.totalElements ?? 0;
if (total > PLAFOND) {
  throw new Error(`La base porte ${total} dossiers : le plafond demandé est ${PLAFOND}.`);
}

// Chaque dossier créé doit porter ses parties et son agence : c'est tout l'objet de la reprise.
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
