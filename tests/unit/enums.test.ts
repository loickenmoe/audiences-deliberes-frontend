import { describe, expect, it } from "vitest";

import {
  PROFILS_METIER,
  Role,
  StatutCycleVie,
  TypeAlerte,
  libelleRole,
  libelleStatutCycleVie,
  libelleTypeAlerte,
} from "@/types/enums";

describe("énumérations du domaine", () => {
  it("couvre les 17 types d'alerte du backend (Q-22)", () => {
    expect(TypeAlerte).toHaveLength(17);
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

  /** Aucune valeur technique ne doit jamais atteindre l'utilisateur faute de libellé. */
  it.each([
    ["StatutCycleVie", StatutCycleVie, libelleStatutCycleVie],
    ["TypeAlerte", TypeAlerte, libelleTypeAlerte],
    ["Role", Role, libelleRole],
  ])("%s : chaque valeur a un libellé français non vide", (_nom, valeurs, libelles) => {
    for (const valeur of valeurs) {
      expect(libelles[valeur as keyof typeof libelles]).toBeTruthy();
    }
  });

  it("exclut les rôles transverses des profils métier", () => {
    expect(PROFILS_METIER).not.toContain("ROLE_CONSULTATION");
    expect(PROFILS_METIER).not.toContain("ROLE_SAISIE");
    expect(PROFILS_METIER).toHaveLength(6);
  });
});
