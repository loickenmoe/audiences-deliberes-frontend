import { describe, expect, it } from "vitest";

import {
  CanalPrestataire,
  EvenementPrestataire,
  PROFILS_METIER,
  Role,
  StatutCycleVie,
  TypeAlerte,
} from "@/types/enums";

/**
 * Checks the **contract**: the values the backend returns. Labels live in the translation files
 * and are checked by `messages.test.ts`.
 */
describe("énumérations du domaine", () => {
  it("couvre les 19 types d'alerte du backend (Q-22, N7)", () => {
    expect(TypeAlerte).toHaveLength(19);
  });

  it("couvre les canaux et les 12 événements prestataires du backend (Q-118, RG-INT-11, RG-INT-06, N7)", () => {
    expect(CanalPrestataire).toEqual(["COURRIEL_PERSONNEL", "SMS", "WHATSAPP"]);
    expect(EvenementPrestataire).toHaveLength(12);
  });

  it("décrit le cycle de vie d'une étape dans l'ordre de progression", () => {
    expect(StatutCycleVie).toEqual([
      "OUVERTURE",
      "EN_COURS",
      "EN_DELIBERE",
      "DELIBERE_VIDE",
      "CLOTURE",
      "ARCHIVE",
    ]);
  });

  it("expose les 8 rôles Keycloak du realm", () => {
    expect(Role).toHaveLength(8);
  });

  it("exclut les rôles transverses des profils métier", () => {
    expect(PROFILS_METIER).not.toContain("ROLE_CONSULTATION");
    expect(PROFILS_METIER).not.toContain("ROLE_SAISIE");
    expect(PROFILS_METIER).toHaveLength(6);
  });
});
