import { describe, expect, it } from "vitest";

import {
  estExerciceDeRecours,
  etapesCreables,
  etapesIntermediairesCreees,
  transitionsPermises,
} from "@/lib/transitions";

/**
 * Le miroir de `EtapeTransitionValidator` doit rester **exactement** aligné sur le backend : s'il
 * proposait une transition que le backend refuse, l'utilisateur la choisirait pour recevoir un
 * `ERR-004` ; s'il en omettait une, un parcours métier deviendrait impossible depuis l'interface.
 * Ces attentes recopient la table du backend, transition par transition.
 */
describe("transitionsPermises", () => {
  it.each([
    ["OUVERTURE", ["EN_COURS"]],
    ["EN_COURS", ["EN_DELIBERE"]],
    ["DELIBERE_VIDE", ["CLOTURE", "EN_COURS"]],
    ["CLOTURE", ["ARCHIVE"]],
    ["ARCHIVE", []],
  ] as const)("depuis %s : %j", (de, attendues) => {
    expect(transitionsPermises(de)).toEqual(attendues);
  });

  it("ne propose rien depuis EN_DELIBERE : le délibéré et le rabattement ont leurs endpoints", () => {
    // Les proposer ici contournerait la saisie du résultat, du délai de recours ou du motif.
    expect(transitionsPermises("EN_DELIBERE")).toEqual([]);
  });
});

describe("estExerciceDeRecours", () => {
  it("reconnaît le seul retour arrière permis par l'endpoint générique", () => {
    expect(estExerciceDeRecours("DELIBERE_VIDE", "EN_COURS")).toBe(true);
  });

  it("ne confond pas une progression ordinaire avec un recours", () => {
    expect(estExerciceDeRecours("OUVERTURE", "EN_COURS")).toBe(false);
    expect(estExerciceDeRecours("DELIBERE_VIDE", "CLOTURE")).toBe(false);
  });
});

describe("positionnement direct", () => {
  it("annonce le premier recours créé en passant quand on vise le second", () => {
    expect(etapesIntermediairesCreees("RECOURS_2", ["INSTANCE"])).toEqual(["RECOURS_1"]);
  });

  it("n'annonce rien quand les étapes précédentes existent déjà", () => {
    expect(etapesIntermediairesCreees("RECOURS_2", ["INSTANCE", "RECOURS_1"])).toEqual([]);
  });

  it("ne propose que les étapes encore absentes", () => {
    expect(etapesCreables(["INSTANCE"])).toEqual(["RECOURS_1", "RECOURS_2"]);
    expect(etapesCreables(["INSTANCE", "RECOURS_1", "RECOURS_2"])).toEqual([]);
  });
});
