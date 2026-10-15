import { describe, expect, it } from "vitest";

import { NAVIGATION } from "@/lib/navigation";
import { CAPACITES, type Capacite, aRole, peut, profilPrincipal } from "@/lib/rbac";

/**
 * Jeux de rôles **réels**, relevés dans les jetons émis par le Keycloak du projet — pas des
 * combinaisons théoriques. Relevé refait le **2026-09-14** : depuis Q-81, `ROLE_DJ` et `ROLE_DJA`
 * sont composites et portent aussi `ROLE_JURISTE`, ce que le relevé du 2026-09-08 ignorait. C'est ce
 * qui rend le parcours de pilotage P9 jouable par le DJ et ferme l'essentiel de QF-04.
 */
const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJA = ["ROLE_DJA", "ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const ASSISTANTE = ["ROLE_ASSISTANTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const SH = ["ROLE_SH", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const AVOCAT = ["ROLE_AVOCAT"];

describe("aRole", () => {
  it("reconnaît un rôle parmi plusieurs portés simultanément", () => {
    expect(aRole(JURISTE, "ROLE_JURISTE")).toBe(true);
    expect(aRole(JURISTE, "ROLE_DJ", "ROLE_JURISTE")).toBe(true);
  });

  it("refuse quand aucun rôle attendu n'est porté", () => {
    expect(aRole(JURISTE, "ROLE_DJ")).toBe(false);
  });

  it("tolère une session sans rôles", () => {
    expect(aRole(undefined, "ROLE_JURISTE")).toBe(false);
    expect(aRole([], "ROLE_JURISTE")).toBe(false);
  });
});

describe("profilPrincipal", () => {
  it("ignore les rôles transverses", () => {
    expect(profilPrincipal(JURISTE)).toBe("ROLE_JURISTE");
    expect(profilPrincipal(ASSISTANTE)).toBe("ROLE_ASSISTANTE");
  });

  it("retient le profil le plus élevé si plusieurs coexistaient", () => {
    expect(profilPrincipal(["ROLE_JURISTE", "ROLE_DJ"])).toBe("ROLE_DJ");
  });

  it("renvoie null sans profil métier", () => {
    expect(profilPrincipal(["ROLE_CONSULTATION"])).toBeNull();
  });
});

describe("capacités — miroir des @PreAuthorize du backend", () => {
  it("le juriste crée des dossiers via le composite ROLE_SAISIE", () => {
    expect(peut(JURISTE, "creerDossier")).toBe(true);
  });

  /** `GET /tableau-de-bord` est `hasAnyRole('DJ','DJA')` depuis Q-95 — la direction seule. */
  it("le tableau de bord est réservé au DJ et à la DJA", () => {
    expect(peut(DJ, "consulterTableauDeBord")).toBe(true);
    expect(peut(DJA, "consulterTableauDeBord")).toBe(true);
    expect(peut(JURISTE, "consulterTableauDeBord")).toBe(false);
    expect(peut(ASSISTANTE, "consulterTableauDeBord")).toBe(false);
    expect(peut(SH, "consulterTableauDeBord")).toBe(false);
  });

  /**
   * `GET /rapports` est `hasRole('JURISTE')`. Le DJ et la DJA l'atteignent par leur composite
   * (Q-81) : c'est ce qui rend le parcours P9 jouable et ferme QF-04.
   */
  it("le juriste génère des rapports, le DJ et la DJA par leur composite", () => {
    expect(peut(JURISTE, "genererRapport")).toBe(true);
    expect(peut(DJ, "genererRapport")).toBe(true);
    expect(peut(DJA, "genererRapport")).toBe(true);
    expect(peut(ASSISTANTE, "genererRapport")).toBe(false);
  });

  /**
   * `GET /audiences/calendrier` est `hasAnyRole('JURISTE','DJ')`. La DJA y accède **depuis Q-81**,
   * par son composite — ce n'est pas une exception ajoutée ici, c'est ce que le backend autorise.
   * L'Assistante, elle, ne porte pas `ROLE_JURISTE` et reste exclue.
   */
  it("le calendrier suit le composite : juriste, DJ et DJA, mais pas l'Assistante", () => {
    expect(peut(JURISTE, "consulterCalendrier")).toBe(true);
    expect(peut(DJ, "consulterCalendrier")).toBe(true);
    expect(peut(DJA, "consulterCalendrier")).toBe(true);
    expect(peut(ASSISTANTE, "consulterCalendrier")).toBe(false);
    expect(peut(SH, "consulterCalendrier")).toBe(false);
  });

  /**
   * `GET /repertoire/avocats` est `hasAnyRole('JURISTE','ASSISTANTE')`. La direction y accède elle
   * aussi depuis Q-81 : le composite prime sur l'intention d'origine, et le backend est l'arbitre.
   */
  it("le répertoire suit le composite : la direction y accède depuis Q-81", () => {
    expect(peut(ASSISTANTE, "consulterRepertoire")).toBe(true);
    expect(peut(JURISTE, "consulterRepertoire")).toBe(true);
    expect(peut(DJ, "consulterRepertoire")).toBe(true);
    expect(peut(SH, "consulterRepertoire")).toBe(false);
  });

  /**
   * `GET /rapports/nominatif` est `hasAnyRole('DJ','DJA')` (N6, observation 14). Le rapport **nomme
   * des collègues** : il se tient sur les rôles propres de la direction, jamais sur `ROLE_JURISTE`,
   * composite depuis Q-81 - l'y adosser le donnerait à chaque juriste, donc à tous les nommés.
   */
  it("le rapport nominatif est réservé au DJ et à la DJA, sans fuite par le composite", () => {
    expect(peut(DJ, "consulterRapportNominatif")).toBe(true);
    expect(peut(DJA, "consulterRapportNominatif")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterRapportNominatif")).toBe(false);
    }
  });

  /**
   * `GET /rapports/activite` — **sa propre activité**, pour chacun (Q-133), **avocat compris depuis
   * Q-135**.
   *
   * C'est le pendant du test précédent, et la différence compte : lire l'activité **d'un collègue ou
   * d'un avocat** reste à la direction, lire **la sienne** est à tout le monde.
   *
   * **Ce test affirmait l'inverse, et il avait tort.** J'avais exclu l'avocat en soutenant qu'il
   * n'aurait rien à y lire : « aucune des natures comptées n'est la sienne ». C'était faux - il
   * dépose ses demandes de frais, ses comptes rendus d'audience, ses autres publications, et répond
   * aux demandes d'explication. Corrigé le 2026-10-13 sur demande du métier.
   */
  it("chacun lit sa propre activité, avocat compris", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterMonActivite")).toBe(true);
    }
  });

  /**
   * Et la frontière, qui est tout l'enjeu : **sa** fiche, pas celle d'un autre. Le serveur l'arbitre
   * (il refuse une cible qui n'est pas soi sans être DJ ni DJA) ; cette table dit seulement ce que
   * l'écran propose, et elle ne doit pas proposer plus.
   */
  it("l'activité d'autrui reste à la direction, pour les collègues comme pour les avocats", () => {
    expect(peut(DJ, "consulterRapportNominatif")).toBe(true);
    expect(peut(DJA, "consulterRapportNominatif")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterRapportNominatif")).toBe(false);
    }
  });

  /**
   * **Accueil et Notifications sont ouverts à tout compte, avocat compris** (QF-59).
   *
   * Le défaut signalé le 2026-10-14 : les deux entrées de navigation étaient adossées à
   * `consulterReferentiels`, que l'avocat ne porte pas. Elles disparaissaient de son menu alors que
   * les deux pages s'ouvraient parfaitement pour lui - il les atteignait par le logo de la banque et
   * par la cloche, deux portes sans étiquette.
   *
   * La référence côté backend : `GET /alertes/mes-notifications` porte
   * `@PreAuthorize("isAuthenticated()")`, et l'accueil est une racine unique pour tous les profils
   * depuis QF-19.
   */
  it("l'accueil et les notifications sont ouverts à tout compte, avocat compris", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterAccueil")).toBe(true);
      expect(peut(profil, "consulterSesNotifications")).toBe(true);
    }
  });

  /** Et sans la correction, l'avocat en était écarté : c'est ce que ce rappel fixe. */
  it("l'avocat n'a toujours pas la lecture des référentiels, qui n'était pas la bonne capacité", () => {
    expect(peut(AVOCAT, "consulterReferentiels")).toBe(false);
  });

  it("la signature des constitutions est réservée au supérieur hiérarchique", () => {
    expect(peut(SH, "signerConstitution")).toBe(true);
    expect(peut(JURISTE, "signerConstitution")).toBe(false);
  });

  it("le contrôle d'opportunité des frais est réservé au DJA", () => {
    expect(peut(DJA, "controlerOpportuniteFrais")).toBe(true);
    expect(peut(DJ, "controlerOpportuniteFrais")).toBe(false);
  });

  /**
   * Backend Q-108 — l'administration des paramètres est ouverte à la DJA, pour la continuité de
   * service : le DJ absent, plus personne ne pouvait relever un seuil.
   */
  it("l'administration des paramètres est ouverte au DJ et à la DJA, à eux seuls", () => {
    expect(peut(DJ, "administrerConfigurations")).toBe(true);
    expect(peut(DJA, "administrerConfigurations")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "administrerConfigurations")).toBe(false);
    }
  });

  /**
   * Le pendant du test précédent. L'ouverture consentie à la DJA est **à sens unique** : le DJ ne
   * rejoint pas la DJA sur le contrôle d'opportunité, sans quoi RG-INT-03 perdrait la séparation de
   * ses deux étapes — le même profil préparerait l'avis puis voterait la validation conjointe.
   */
  it("DJ et DJA ne diffèrent plus que par le contrôle d'opportunité", () => {
    const ecarts = (Object.keys(CAPACITES) as Capacite[]).filter(
      (capacite) => peut(DJ, capacite) !== peut(DJA, capacite),
    );
    expect(ecarts).toEqual(["controlerOpportuniteFrais"]);
  });

  /**
   * `ROLE_DJ` et `ROLE_DJA` sont **tous deux** composites de `ROLE_JURISTE` dans Keycloak. Deux
   * commentaires de la table affirmaient le contraire — corrigés avec Q-108. Ces assertions
   * empêchent que la confusion revienne.
   */
  it("le DJ et la DJA atteignent le calendrier et le répertoire par leur rôle juriste", () => {
    for (const profil of [DJ, DJA]) {
      expect(peut(profil, "consulterCalendrier")).toBe(true);
      expect(peut(profil, "consulterRepertoire")).toBe(true);
    }
    expect(peut(ASSISTANTE, "consulterCalendrier")).toBe(false);
    expect(peut(SH, "consulterRepertoire")).toBe(false);
  });
});

describe("périmètre du profil avocat (QF-01)", () => {
  /**
   * L'avocat ne porte pas `ROLE_CONSULTATION` : il est exclu de tout ce qui en dépend. C'est la
   * cause du report du portail avocat au jalon F16.
   */
  it("l'avocat ne consulte ni dossiers, ni clients, ni documents", () => {
    expect(peut(AVOCAT, "consulterDossiers")).toBe(false);
    expect(peut(AVOCAT, "consulterReferentiels")).toBe(false);
    expect(peut(AVOCAT, "consulterDocuments")).toBe(false);
    expect(peut(AVOCAT, "consulterJurisprudence")).toBe(false);
  });

  it("l'avocat dépose des frais et des publications, et consulte ses demandes", () => {
    expect(peut(AVOCAT, "deposerFrais")).toBe(true);
    expect(peut(AVOCAT, "deposerPublication")).toBe(true);
    expect(peut(AVOCAT, "consulterFrais")).toBe(true);
  });

  /**
   * Le périmètre de l'avocat s'énumère, et ne s'élargit pas en silence.
   *
   * Deux sont arrivées avec N7 temps 2 (2026-10-07) : la direction lui demande de s'expliquer sur
   * des comptes rendus manquants, il répond. Elles ne lui ouvrent rien du dossier - il lit les
   * demandes **qui lui sont adressées**, le serveur décidant lesquelles, et ne répond qu'aux
   * siennes.
   *
   * Une autre est arrivée le 2026-10-13 (Q-135) : il lit et télécharge **sa propre** activité. Elle
   * ne lui ouvre rien de plus non plus - le serveur refuse toute autre personne, et son détail ne
   * porte même pas de lien vers les dossiers, puisqu'il n'a pas d'écran de fiche dossier.
   *
   * Les **deux dernières** sont arrivées le 2026-10-14 (QF-59) : l'accueil et ses notifications.
   * Elles n'élargissent rien - les deux pages lui étaient **déjà ouvertes**, et c'est tout le
   * défaut : seules les entrées de navigation manquaient, adossées à `consulterReferentiels` qu'il
   * ne porte pas. Il y arrivait par le logo de la banque et par la cloche, sans onglet pour le dire.
   */
  it("l'avocat n'accède qu'à une poignée de capacités", () => {
    const accordees = (Object.keys(CAPACITES) as Capacite[]).filter((c) => peut(AVOCAT, c));
    // L'ordre est celui de la déclaration dans la table : « mon activité » a été ajoutée en
    // dernier, à côté des autres capacités de reporting.
    expect(accordees).toEqual([
      "consulterFrais",
      "deposerFrais",
      "deposerPublication",
      "consulterExplications",
      "repondreExplication",
      "consulterMonActivite",
      "consulterAccueil",
      "consulterSesNotifications",
    ]);
  });
});

/**
 * Ce que chaque profil **voit dans son menu** (QF-59).
 *
 * Ce bloc ne vérifie pas des capacités mais la **navigation**, et c'est lui qui aurait attrapé le
 * défaut signalé le 2026-10-14 : les capacités étaient justes, l'avocat pouvait bel et bien ouvrir
 * l'accueil et ses notifications ; c'étaient les **entrées de menu** qui citaient la mauvaise
 * capacité. Un test sur `CAPACITES` seul serait resté vert.
 */
/**
 * Le partage des pièces avec l'avocat (QF-64, backend Q-139), tel qu'arbitré le 2026-10-15 : tout
 * juriste partage - le DJ et la DJA par leur rôle composite -, la validation d'un dossier sensible
 * reste au DJ et à la DJA, et ni l'Assistante, ni le SH, ni l'avocat n'y touchent.
 */
describe("partage des pièces avec l'avocat (QF-64)", () => {
  it("tout juriste partage et écrit la note à l'avocat, DJ et DJA compris", () => {
    for (const profil of [JURISTE, DJ, DJA]) {
      expect(peut(profil, "partagerDocument")).toBe(true);
      expect(peut(profil, "ecrireNoteAvocat")).toBe(true);
    }
  });

  it("seuls le DJ et la DJA valident un partage", () => {
    expect(peut(DJ, "arbitrerPartages")).toBe(true);
    expect(peut(DJA, "arbitrerPartages")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "arbitrerPartages")).toBe(false);
    }
  });

  it("ni l'Assistante, ni le SH, ni l'avocat ne partagent", () => {
    for (const profil of [ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "partagerDocument")).toBe(false);
      expect(peut(profil, "ecrireNoteAvocat")).toBe(false);
    }
  });

  it("la file des partages n'est au menu que du DJ et de la DJA", () => {
    const menu = (roles: readonly string[]) =>
      NAVIGATION.filter((e) => e.livre && peut(roles, e.capacite)).map((e) => e.cle);
    expect(menu(DJ)).toContain("partagesAvocat");
    expect(menu(DJA)).toContain("partagesAvocat");
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(menu(profil)).not.toContain("partagesAvocat");
    }
  });
});

describe("navigation visible par profil (QF-59)", () => {
  const menu = (roles: readonly string[]) =>
    NAVIGATION.filter((e) => e.livre && peut(roles, e.capacite)).map((e) => e.cle);

  it("l'avocat trouve l'accueil et ses notifications dans son menu", () => {
    expect(menu(AVOCAT)).toContain("accueil");
    expect(menu(AVOCAT)).toContain("notifications");
  });

  /**
   * Le menu de l'avocat s'énumère en entier : une entrée qui s'y ajouterait en silence pourrait lui
   * proposer un écran qu'il n'a pas le droit d'ouvrir - l'erreur contre laquelle met en garde le
   * commentaire de « Mon compte » dans `lib/navigation.ts`.
   */
  it("et rien d'autre ne s'est glissé dans le menu de l'avocat", () => {
    expect(menu(AVOCAT)).toEqual([
      "accueil",
      "monEspace",
      "deposerFrais",
      "deposerPublication",
      "notifications",
      "frais",
      "explications",
    ]);
  });

  it("les profils internes gardent l'accueil et les notifications", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH]) {
      expect(menu(profil)).toContain("accueil");
      expect(menu(profil)).toContain("notifications");
    }
  });

  /** Et « Mon compte » reste hors de son menu : il ne signe aucune lettre de la banque (Q-135). */
  it("« Mon compte » reste réservé aux profils internes", () => {
    expect(menu(AVOCAT)).not.toContain("monCompte");
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH]) {
      expect(menu(profil)).toContain("monCompte");
    }
  });
});

describe("cohérence de la table", () => {
  it("aucune capacité n'est vide — une capacité sans rôle serait inatteignable", () => {
    for (const [nom, roles] of Object.entries(CAPACITES)) {
      expect(roles.length, `capacité « ${nom} » sans rôle`).toBeGreaterThan(0);
    }
  });

  it("les cinq profils internes ont chacun au moins une capacité propre", () => {
    for (const roles of [JURISTE, DJ, DJA, ASSISTANTE, SH]) {
      const accordees = (Object.keys(CAPACITES) as Capacite[]).filter((c) => peut(roles, c));
      expect(accordees.length).toBeGreaterThan(0);
    }
  });
});
