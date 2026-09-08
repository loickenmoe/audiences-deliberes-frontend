import { describe, expect, it } from "vitest";

import { CAPACITES, type Capacite, aRole, peut, profilPrincipal } from "@/lib/rbac";

/**
 * Jeux de rôles **réels**, relevés dans les jetons émis par le Keycloak du projet le 2026-09-08 —
 * pas des combinaisons théoriques.
 */
const JURISTE = ["ROLE_JURISTE", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJ = ["ROLE_DJ", "ROLE_SAISIE", "ROLE_CONSULTATION"];
const DJA = ["ROLE_DJA", "ROLE_SAISIE", "ROLE_CONSULTATION"];
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

  /** `GET /tableau-de-bord` est `hasRole('DJ')` : le DJA en est exclu. Cf. QF-04. */
  it("seul le DJ accède au tableau de bord", () => {
    expect(peut(DJ, "consulterTableauDeBord")).toBe(true);
    expect(peut(DJA, "consulterTableauDeBord")).toBe(false);
    expect(peut(JURISTE, "consulterTableauDeBord")).toBe(false);
  });

  /** `GET /rapports` est `hasRole('JURISTE')` : le DJ ne peut pas générer de rapport. Cf. QF-04. */
  it("seul le juriste génère des rapports", () => {
    expect(peut(JURISTE, "genererRapport")).toBe(true);
    expect(peut(DJ, "genererRapport")).toBe(false);
  });

  /** `GET /audiences/calendrier` est `hasAnyRole('JURISTE','DJ')` — ni DJA ni Assistante. */
  it("le calendrier est réservé au juriste et au DJ", () => {
    expect(peut(JURISTE, "consulterCalendrier")).toBe(true);
    expect(peut(DJ, "consulterCalendrier")).toBe(true);
    expect(peut(DJA, "consulterCalendrier")).toBe(false);
    expect(peut(ASSISTANTE, "consulterCalendrier")).toBe(false);
  });

  /** `GET /repertoire/avocats` est `hasAnyRole('JURISTE','ASSISTANTE')` — ni DJ ni DJA. */
  it("le répertoire des avocats exclut la direction", () => {
    expect(peut(ASSISTANTE, "consulterRepertoire")).toBe(true);
    expect(peut(DJ, "consulterRepertoire")).toBe(false);
  });

  it("la signature des constitutions est réservée au supérieur hiérarchique", () => {
    expect(peut(SH, "signerConstitution")).toBe(true);
    expect(peut(JURISTE, "signerConstitution")).toBe(false);
  });

  it("le contrôle d'opportunité des frais est réservé au DJA", () => {
    expect(peut(DJA, "controlerOpportuniteFrais")).toBe(true);
    expect(peut(DJ, "controlerOpportuniteFrais")).toBe(false);
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

  it("l'avocat n'accède qu'à une poignée de capacités", () => {
    const accordees = (Object.keys(CAPACITES) as Capacite[]).filter((c) => peut(AVOCAT, c));
    expect(accordees).toEqual(["consulterFrais", "deposerFrais", "deposerPublication"]);
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
