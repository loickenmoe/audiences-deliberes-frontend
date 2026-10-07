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
 * Ce fichier vérifie le **contrat** : les valeurs que le backend renvoie. Les libellés, eux, sont
 * vérifiés par `messages.test.ts` — ils vivent désormais dans les fichiers de traduction.
 */
describe("énumérations du domaine", () => {
  it("couvre les 18 types d'alerte du backend (Q-22, N7)", () => {
    expect(TypeAlerte).toHaveLength(18);
  });

  it("couvre les canaux et les 11 événements prestataires du backend (Q-118, RG-INT-11, RG-INT-06)", () => {
    expect(CanalPrestataire).toEqual(["COURRIEL_PERSONNEL", "SMS", "WHATSAPP"]);
    expect(EvenementPrestataire).toHaveLength(11);
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
