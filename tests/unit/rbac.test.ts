import { describe, expect, it } from "vitest";

import { NAVIGATION } from "@/lib/navigation";
import { CAPACITES, type Capacite, aRole, peut, profilPrincipal } from "@/lib/rbac";

/**
 * **Real** role sets, captured from tokens issued by the project's Keycloak, not theoretical
 * combinations. `ROLE_DJ` and `ROLE_DJA` are composite and also carry `ROLE_JURISTE`, which makes
 * the P9 management flow available to the DJ.
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

  /** `GET /tableau-de-bord` is `hasAnyRole('DJ','DJA')`: management only. */
  it("le tableau de bord est réservé au DJ et à la DJA", () => {
    expect(peut(DJ, "consulterTableauDeBord")).toBe(true);
    expect(peut(DJA, "consulterTableauDeBord")).toBe(true);
    expect(peut(JURISTE, "consulterTableauDeBord")).toBe(false);
    expect(peut(ASSISTANTE, "consulterTableauDeBord")).toBe(false);
    expect(peut(SH, "consulterTableauDeBord")).toBe(false);
  });

  /**
   * `GET /rapports` is open to the legal officer (and the DJ and DJA through their composite role),
   * the Assistant and the SH since 2026-10-21. The avocat stays out.
   */
  it("les rapports s'ouvrent au juriste, à la direction, à l'Assistante et au SH", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH]) {
      expect(peut(profil, "genererRapport")).toBe(true);
    }
    expect(peut(AVOCAT, "genererRapport")).toBe(false);
  });

  /**
   * `GET /audiences/calendrier` is open to the legal officer, the DJ (the DJA through its composite
   * role), the Assistant and the SH since 2026-10-21.
   */
  it("le calendrier s'ouvre aux cinq profils internes, pas à l'avocat", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH]) {
      expect(peut(profil, "consulterCalendrier")).toBe(true);
    }
    expect(peut(AVOCAT, "consulterCalendrier")).toBe(false);
  });

  /**
   * `GET /repertoire/avocats` is `hasAnyRole('JURISTE','ASSISTANTE')`. Management reaches it too
   * through the composite role; the backend is the authority.
   */
  it("le répertoire suit le composite : la direction y accède depuis Q-81", () => {
    expect(peut(ASSISTANTE, "consulterRepertoire")).toBe(true);
    expect(peut(JURISTE, "consulterRepertoire")).toBe(true);
    expect(peut(DJ, "consulterRepertoire")).toBe(true);
    expect(peut(SH, "consulterRepertoire")).toBe(true);
    expect(peut(AVOCAT, "consulterRepertoire")).toBe(false);
  });

  /**
   * Since 2026-10-21 the Assistant and the SH also consult the hearings journal, publications and
   * the daily DMS report. Consultation only: validating, commenting, sending the correspondence and
   * the named activity reports stay with their owners.
   */
  it("l'Assistante et le SH consultent journal, publications et rapport journalier, sans les actions", () => {
    for (const profil of [ASSISTANTE, SH]) {
      expect(peut(profil, "consulterJournalAudiences")).toBe(true);
      expect(peut(profil, "consulterPublications")).toBe(true);
      expect(peut(profil, "consulterRapportJournalier")).toBe(true);
      expect(peut(profil, "commenterPublication")).toBe(false);
      expect(peut(profil, "transmettreCorrespondance")).toBe(false);
      expect(peut(profil, "consulterRapportNominatif")).toBe(false);
    }
    expect(peut(ASSISTANTE, "validerPublication")).toBe(true);
    expect(peut(SH, "validerPublication")).toBe(false);
    expect(peut(AVOCAT, "consulterJournalAudiences")).toBe(false);
  });

  /**
   * `GET /rapports/nominatif` is `hasAnyRole('DJ','DJA')` (N6). The report **names colleagues**: it
   * relies on management's own roles, never on the composite `ROLE_JURISTE`, which would open it to
   * every legal officer.
   */
  it("le rapport nominatif est réservé au DJ et à la DJA, sans fuite par le composite", () => {
    expect(peut(DJ, "consulterRapportNominatif")).toBe(true);
    expect(peut(DJA, "consulterRapportNominatif")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterRapportNominatif")).toBe(false);
    }
  });

  /**
   * `GET /rapports/activite`: **one's own activity**, for everyone, **lawyers included** (they submit
   * fee requests, hearing reports and other publications, and answer explanation requests).
   * Reading **a colleague's or a lawyer's** activity remains with management.
   */
  it("chacun lit sa propre activité, avocat compris", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterMonActivite")).toBe(true);
    }
  });

  /**
   * The boundary: **one's own** sheet, not someone else's. The server enforces it (it rejects another
   * target unless DJ or DJA); this table only states what the screen offers, and must not offer more.
   */
  it("l'activité d'autrui reste à la direction, pour les collègues comme pour les avocats", () => {
    expect(peut(DJ, "consulterRapportNominatif")).toBe(true);
    expect(peut(DJA, "consulterRapportNominatif")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterRapportNominatif")).toBe(false);
    }
  });

  /**
   * **Home and Notifications are open to every account, lawyers included.** They must not depend on
   * `consulterReferentiels`, which lawyers do not hold. Backend: `GET /alertes/mes-notifications` is
   * `@PreAuthorize("isAuthenticated()")`, and home is a single root for all profiles.
   */
  it("l'accueil et les notifications sont ouverts à tout compte, avocat compris", () => {
    for (const profil of [JURISTE, DJ, DJA, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "consulterAccueil")).toBe(true);
      expect(peut(profil, "consulterSesNotifications")).toBe(true);
    }
  });

  /** Lawyers must not be excluded from them. */
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
   * Settings administration is open to the DJA for business continuity: when the DJ is absent,
   * someone must still be able to raise a threshold.
   */
  it("l'administration des paramètres est ouverte au DJ et à la DJA, à eux seuls", () => {
    expect(peut(DJ, "administrerConfigurations")).toBe(true);
    expect(peut(DJA, "administrerConfigurations")).toBe(true);
    for (const profil of [JURISTE, ASSISTANTE, SH, AVOCAT]) {
      expect(peut(profil, "administrerConfigurations")).toBe(false);
    }
  });

  /**
   * The opening granted to the DJA is **one-way**: the DJ does not join the DJA on the opportunity
   * check, otherwise RG-INT-03 would lose the separation of its two steps (the same profile would
   * prepare the opinion and then vote the joint validation).
   */
  it("DJ et DJA ne diffèrent plus que par le contrôle d'opportunité", () => {
    const ecarts = (Object.keys(CAPACITES) as Capacite[]).filter(
      (capacite) => peut(DJ, capacite) !== peut(DJA, capacite),
    );
    expect(ecarts).toEqual(["controlerOpportuniteFrais"]);
  });

  /**
   * `ROLE_DJ` and `ROLE_DJA` are **both** composites of `ROLE_JURISTE` in Keycloak.
   */
  it("le DJ et la DJA atteignent le calendrier et le répertoire par leur rôle juriste", () => {
    for (const profil of [DJ, DJA]) {
      expect(peut(profil, "consulterCalendrier")).toBe(true);
      expect(peut(profil, "consulterRepertoire")).toBe(true);
    }
  });
});

describe("périmètre du profil avocat (QF-01)", () => {
  /**
   * Lawyers do not carry `ROLE_CONSULTATION`: they are excluded from everything that depends on it.
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
   * The lawyer's scope is listed explicitly and never widens silently. It includes reading the
   * explanation requests **addressed to them** (the server decides which) and answering their own,
   * reading and downloading **their own** activity, and the home and notifications pages.
   */
  it("l'avocat n'accède qu'à une poignée de capacités", () => {
    const accordees = (Object.keys(CAPACITES) as Capacite[]).filter((c) => peut(AVOCAT, c));
    // Order follows the declaration in the table, where "my activity" sits with the other
    // reporting capabilities.
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
 * What each profile **sees in its menu**. This block checks **navigation**, not capabilities: a menu
 * entry citing the wrong capability would hide a page the user may open, and a test on
 * `CAPACITES` alone would stay green.
 */
/**
 * Sharing documents with the lawyer: every legal officer shares (DJ and DJA through their composite
 * role); validation on a sensitive case file stays with the DJ and DJA.
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

  /**
   * SH and the Assistant can share, like legal officers. The note to the lawyer stays with the legal
   * officer and must not open up silently.
   */
  it("le SH et l'Assistante partagent aussi, sans écrire la note à l'avocat", () => {
    for (const profil of [SH, ASSISTANTE]) {
      expect(peut(profil, "partagerDocument")).toBe(true);
      expect(peut(profil, "ecrireNoteAvocat")).toBe(false);
    }
  });

  it("l'avocat ne partage ni n'écrit de note", () => {
    expect(peut(AVOCAT, "partagerDocument")).toBe(false);
    expect(peut(AVOCAT, "ecrireNoteAvocat")).toBe(false);
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
   * The lawyer's menu is listed in full: an entry added silently could offer a screen they may not
   * open (see the "Mon compte" comment in `lib/navigation.ts`).
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

  /** "Mon compte" stays out of their menu: they sign no letter on behalf of the bank. */
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
