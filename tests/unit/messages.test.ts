import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LANGUES } from "@/i18n/config";
import { ENUMERATIONS_TRADUITES, Role } from "@/types/enums";

/**
 * Bilingualism guard. The real risk is **forgetting** to translate: a key added in French but not
 * in English would show a technical identifier to an English-speaking user.
 */

type Langue = (typeof LANGUES)[number];

/** All `.tsx` files under a root, to look for a key in the screens. */
function fichiersTsx(racine: string): string[] {
  return readdirSync(racine, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) return fichiersTsx(chemin);
    return entree.name.endsWith(".tsx") ? [chemin] : [];
  });
}


const messages = Object.fromEntries(
  LANGUES.map((langue) => [
    langue,
    JSON.parse(readFileSync(join(process.cwd(), `messages/${langue}.json`), "utf8")) as Record<
      string,
      unknown
    >,
  ]),
) as Record<Langue, Record<string, unknown>>;

/** Dotted paths of all leaves of a messages object. */
function cles(objet: unknown, prefixe = ""): string[] {
  if (typeof objet !== "object" || objet === null) return [prefixe];
  return Object.entries(objet).flatMap(([cle, valeur]) =>
    cles(valeur, prefixe ? `${prefixe}.${cle}` : cle),
  );
}

function lire(langue: Langue, chemin: string): unknown {
  return chemin
    .split(".")
    .reduce<unknown>(
      (courant, segment) => (courant as Record<string, unknown> | undefined)?.[segment],
      messages[langue],
    );
}

describe("parité des fichiers de messages", () => {
  it("les deux langues exposent exactement les mêmes clés", () => {
    const fr = new Set(cles(messages.fr));
    const en = new Set(cles(messages.en));

    expect([...fr].filter((c) => !en.has(c)), "clés absentes de en.json").toEqual([]);
    expect([...en].filter((c) => !fr.has(c)), "clés absentes de fr.json").toEqual([]);
  });

  it.each(LANGUES)("aucune valeur vide dans %s.json", (langue) => {
    const vides = cles(messages[langue]).filter((c) => {
      const valeur = lire(langue, c);
      return typeof valeur !== "string" || valeur.trim() === "";
    });
    expect(vides).toEqual([]);
  });
});

describe("couverture du domaine", () => {
  /**
   * The backend returns raw codes only. An enum value without a label would show `EN_DELIBERE` on
   * screen.
   */
  it.each(LANGUES)("chaque valeur d'énumération a un libellé en %s", (langue) => {
    const absents: string[] = [];

    for (const [enumeration, valeurs] of Object.entries(ENUMERATIONS_TRADUITES)) {
      for (const valeur of valeurs) {
        const chemin = `domaine.${enumeration}.${valeur}`;
        if (typeof lire(langue, chemin) !== "string") absents.push(chemin);
      }
    }

    expect(absents).toEqual([]);
  });

  /**
   * Notification monitoring names the same events **elsewhere**: screen 41 reads its own block,
   * `supervisionNotifications.evenements`, not `domaine.*`. An event missing there shows its raw code.
   * The block covers both internal alerts **and** provider events, since monitoring shows all channels.
   */
  it.each(LANGUES)("chaque événement supervisé a un libellé en %s", (langue) => {
    const supervises = [...ENUMERATIONS_TRADUITES.TypeAlerte, ...ENUMERATIONS_TRADUITES.EvenementPrestataire];
    const absents = supervises.filter(
      (evenement) => typeof lire(langue, `supervisionNotifications.evenements.${evenement}`) !== "string",
    );

    expect(absents, "événements que la supervision afficherait en code brut").toEqual([]);
  });

  /**
   * `historique.actions` translates the action types of the audit and activity screens. These types
   * are not in `types/enums.ts`, so the list comes from the contract, `contracts/openapi.json`,
   * which carries the enum as the backend exposes it.
   */
  it.each(LANGUES)("chaque nature d'action du contrat a un libellé en %s", (langue) => {
    const contrat = JSON.parse(
      readFileSync(join(process.cwd(), "contracts/openapi.json"), "utf8"),
    ) as {
      components: {
        schemas: {
          HistoriqueActionResponse: { properties: { code: { enum: string[] } } };
        };
      };
    };
    const natures = contrat.components.schemas.HistoriqueActionResponse.properties.code.enum;

    // If the contract ever stopped carrying the enum, this test would pass on an empty array. The
    // lower bound guards against that.
    expect(natures.length, "le contrat ne porte plus l'énumération des natures d'action").toBeGreaterThan(50);

    const absents = natures.filter(
      (nature) => typeof lire(langue, `historique.actions.${nature}`) !== "string",
    );
    expect(absents, "natures que l'audit et la fiche d'activité afficheraient en code brut").toEqual([]);
  });

  it.each(LANGUES)("chaque rôle Keycloak a un libellé en %s", (langue) => {
    const absents = Role.filter((role) => typeof lire(langue, `roles.${role}`) !== "string");
    expect(absents).toEqual([]);
  });

  /** Backend errors are displayed from their code, never from the French message. */
  it.each(LANGUES)("chaque code d'erreur du backend a un message en %s", (langue) => {
    const codes = [
      "ERR-001",
      "ERR-002",
      "ERR-003",
      "ERR-004",
      "ERR-005",
      "ERR-006",
      "ERR-008",
      "ERR-009",
      "ERR-VALIDATION",
      "ERR-UNAUTHENTICATED",
      "ERR-FORBIDDEN",
      "ERR-NOT-FOUND",
      "ERR-CONFLICT",
      "ERR-BUSINESS-RULE",
      "ERR-INTERNAL",
    ];
    const absents = codes.filter((code) => typeof lire(langue, `erreurs.${code}`) !== "string");
    expect(absents).toEqual([]);
  });

  /**
   * Case file natures and sensitive client types are **closed** backend lists with a French-only
   * `libelle` column: the frontend translates them from their `code`.
   */
  it.each(LANGUES)("les 17 natures de dossier du backend sont traduites en %s", (langue) => {
    const natures = lire(langue, "referentiels.naturesDossier") as Record<string, string>;
    expect(Object.keys(natures)).toHaveLength(17);
  });

  it.each(LANGUES)("les 3 types de client sensible sont traduits en %s", (langue) => {
    const types = lire(langue, "referentiels.typesClientSensible") as Record<string, string>;
    expect(Object.keys(types)).toHaveLength(3);
  });

  /**
   * The 9 keys displayed individually on screen 41. The six notification grid columns are not among
   * them: they are read in their table, by channel and event.
   */
  it.each(LANGUES)("les 9 clés de configuration de la liste sont décrites en %s", (langue) => {
    const config = lire(langue, "referentiels.configurations") as Record<string, string>;
    expect(Object.keys(config)).toEqual([
      "SEUIL_MONTANT_DEFAUT",
      "SEUIL_PROROGATIONS",
      "CANAUX_NOTIFICATION_DEFAUT",
      "CANAUX_NOTIFICATION_PRESTATAIRES",
      "DELAI_VALIDATION_CONJOINTE",
      "DELAI_RAPPEL_CR_AVOCAT",
      "TAILLE_MAX_GED",
      "FORMATS_GED",
      "CHARGE_MAX_AVOCAT",
    ]);
  });
});

describe("traductions distinctes", () => {
  /**
   * If English copied French, these texts would be identical. Only strings that must really differ
   * are checked (not "PDF" or "Excel").
   */
  it("les textes d'interface diffèrent réellement entre les deux langues", () => {
    const aVerifier = [
      "connexion.bienvenue",
      "connexion.identifiant",
      "connexion.motDePasse",
      "navigation.dossiers",
      "erreurs.ERR-002",
      "domaine.StatutCycleVie.EN_DELIBERE",
      "roles.ROLE_JURISTE",
    ];

    for (const chemin of aVerifier) {
      expect(lire("fr", chemin), chemin).not.toBe(lire("en", chemin));
    }
  });
});

/**
 * Explanatory placeholders (N5). A placeholder lives in an attribute, so removing it from a field
 * goes unnoticed while the key remains in both language files. A declared `ph…` key must be used
 * on a field.
 */
describe("placeholders explicatifs", () => {
  const source = ["components", "app"]
    .flatMap((racine) => fichiersTsx(join(process.cwd(), racine)))
    .map((chemin) => readFileSync(chemin, "utf8"))
    .join("\n");

  const declarees = Object.entries(messages.fr as Record<string, Record<string, string>>)
    .flatMap(([espace, cles]) =>
      Object.keys(cles)
        .filter((cle) => /^(ph|placeholder)[A-Z]/.test(cle))
        .map((cle) => `${espace}.${cle}`),
    );

  it("il y en a, et les deux langues les portent toutes les deux", () => {
    expect(declarees.length).toBeGreaterThanOrEqual(48);
  });

  it("chaque placeholder déclaré est posé sur un champ", () => {
    const orphelines = declarees.filter(
      (chemin) => !source.includes(`"${chemin.split(".")[1]}"`),
    );
    expect(orphelines, "clés de placeholder que plus aucun champ n'emploie").toEqual([]);
  });
});
