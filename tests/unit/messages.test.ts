import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { LANGUES } from "@/i18n/config";
import { ENUMERATIONS_TRADUITES, Role } from "@/types/enums";

/**
 * Garde-fou du bilinguisme.
 *
 * Le risque réel n'est pas de mal traduire : c'est d'**oublier** de traduire. Une clé ajoutée en
 * français et pas en anglais passerait inaperçue jusqu'à ce qu'un utilisateur anglophone tombe sur
 * un identifiant technique au milieu de son écran. Ces tests rendent l'oubli impossible.
 */

type Langue = (typeof LANGUES)[number];

const messages = Object.fromEntries(
  LANGUES.map((langue) => [
    langue,
    JSON.parse(readFileSync(join(process.cwd(), `messages/${langue}.json`), "utf8")) as Record<
      string,
      unknown
    >,
  ]),
) as Record<Langue, Record<string, unknown>>;

/** Chemins de toutes les feuilles d'un objet de messages, en notation pointée. */
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
   * Le backend ne renvoie que des codes bruts. Une valeur d'énumération sans libellé afficherait
   * `EN_DELIBERE` à l'écran.
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

  it.each(LANGUES)("chaque rôle Keycloak a un libellé en %s", (langue) => {
    const absents = Role.filter((role) => typeof lire(langue, `roles.${role}`) !== "string");
    expect(absents).toEqual([]);
  });

  /** Les codes d'erreur du backend sont affichés à partir du code, jamais du message français. */
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
   * Les natures de dossier et types de client sensible sont des listes **fermées** du backend,
   * relevées en conditions réelles. Elles n'ont qu'une colonne `libelle`, en français : c'est le
   * frontend qui les traduit, à partir de leur `code`.
   */
  it.each(LANGUES)("les 17 natures de dossier du backend sont traduites en %s", (langue) => {
    const natures = lire(langue, "referentiels.naturesDossier") as Record<string, string>;
    expect(Object.keys(natures)).toHaveLength(17);
  });

  it.each(LANGUES)("les 3 types de client sensible sont traduits en %s", (langue) => {
    const types = lire(langue, "referentiels.typesClientSensible") as Record<string, string>;
    expect(Object.keys(types)).toHaveLength(3);
  });

  it.each(LANGUES)("les 7 clés de configuration sont décrites en %s", (langue) => {
    const config = lire(langue, "referentiels.configurations") as Record<string, string>;
    expect(Object.keys(config)).toHaveLength(7);
  });
});

describe("traductions distinctes", () => {
  /**
   * Contrôle de vigilance : si l'anglais recopiait le français, ces textes seraient identiques.
   * On ne vérifie que des chaînes qui doivent réellement différer — pas « PDF » ni « Excel ».
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
