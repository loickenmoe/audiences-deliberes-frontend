import { readdirSync, readFileSync } from "node:fs";
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

/** Tous les `.tsx` sous une racine : de quoi chercher une clé dans les écrans, pas dans un index. */
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

  /**
   * La supervision des notifications nomme les mêmes événements, **ailleurs**.
   *
   * **Le trou que ce test ferme.** L'écran 41 ne lit pas `domaine.*` mais son propre bloc,
   * `supervisionNotifications.evenements` : un événement traduit dans le premier et oublié dans le
   * second affiche son code brut au Directeur Juridique. C'est arrivé deux fois sans que rien ne le
   * dise - `COMPTE_RENDU_ATTENDU` et `COMPTE_RENDU_RECU` y manquaient depuis le 2026-10-05, et
   * `DEMANDE_EXPLICATION` les a rejoints - parce qu'aucun test ne regardait ce bloc-là.
   *
   * Il porte les deux familles : les alertes internes **et** les événements prestataires, puisque
   * la supervision montre les envois de tous les canaux.
   */
  it.each(LANGUES)("chaque événement supervisé a un libellé en %s", (langue) => {
    const supervises = [...ENUMERATIONS_TRADUITES.TypeAlerte, ...ENUMERATIONS_TRADUITES.EvenementPrestataire];
    const absents = supervises.filter(
      (evenement) => typeof lire(langue, `supervisionNotifications.evenements.${evenement}`) !== "string",
    );

    expect(absents, "événements que la supervision afficherait en code brut").toEqual([]);
  });

  /**
   * **Le troisième bloc qui nomme des codes, et le troisième trou de la même famille.**
   *
   * `historique.actions` traduit les natures d'action de l'audit et de la fiche d'activité. Il
   * portait **51 libellés pour 53 codes** : `EXPLICATION_DEMANDEE` et `EXPLICATION_REPONDUE`, livrés
   * avec N7 temps 2 le 2026-10-07, y manquaient - l'écran d'audit les affichait donc en code brut au
   * Directeur Juridique pendant six jours.
   *
   * **Pourquoi les deux gardes existantes ne pouvaient pas le voir.** Celle du domaine tire sa liste
   * de `types/enums.ts`, où les 53 natures d'action ne figurent pas - elles sont trop nombreuses et
   * ne servent qu'à l'affichage. Celle de la supervision ne regarde qu'un autre bloc.
   *
   * **La liste vient donc du contrat**, `contracts/openapi.json`, qui porte l'énumération telle que
   * le backend l'expose et qui est régénérée à chaque jalon. Pas de dépendance au dépôt backend : la
   * source est dans ce dépôt, et elle ne peut pas vieillir sans que le contrat vieillisse aussi.
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

    // Si le contrat cessait un jour de porter l'énumération, ce test passerait sur un tableau vide
    // sans rien garder. La borne basse le dit tout haut.
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

  /**
   * Les 9 clés affichées une à une sur l'écran 41. Les six colonnes de la grille des notifications
   * (Q-118) n'en font pas partie : elles se lisent dans leur tableau, par canal et par événement.
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

/**
 * Les placeholders explicatifs (N5, observation 4).
 *
 * **Le risque propre à ces clés-ci.** Un placeholder vit dans un attribut, pas dans le texte de
 * l'écran : si quelqu'un le retire d'un champ, rien ne manque visiblement, aucun test ne tombe, et
 * la clé reste dans les deux fichiers de langue en faisant croire que le texte est toujours là.
 * Ce garde-fou lie les deux : une clé `ph…` déclarée doit être posée sur un champ.
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
