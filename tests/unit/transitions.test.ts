import { describe, expect, it } from "vitest";

import {
  estExerciceDeRecours,
  etapesCreables,
  etapesIntermediairesCreees,
  transitionsPermises,
} from "@/lib/transitions";

/**
 * The mirror of `EtapeTransitionValidator` must stay **exactly** aligned with the backend: an extra
 * transition would lead to `ERR-004`, a missing one would make a business flow impossible from the UI.
 * These expectations copy the backend table, transition by transition.
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
    // Offering them here would bypass entering the outcome, appeal deadline or reason.
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
    expect(etapesCreables(["INSTANCE"])).toEqual(["RECOURS_1", "RECOURS_2", "RECOURS_2_CCJA"]);
    expect(etapesCreables(["INSTANCE", "RECOURS_1", "RECOURS_2"])).toEqual(["RECOURS_2_CCJA"]);
    expect(etapesCreables(["INSTANCE", "RECOURS_1", "RECOURS_2", "RECOURS_2_CCJA"])).toEqual([]);
  });

  /**
   * A CCJA appeal has the same predecessors as the national appeal, and **not** the Supreme Court:
   * both cassation routes are concurrent. Announcing a Supreme Court step would make the user
   * confirm a side effect the backend does not produce.
   */
  it("n'annonce pas la Cour Suprême quand on positionne directement en CCJA", () => {
    expect(etapesIntermediairesCreees("RECOURS_2_CCJA", ["INSTANCE"])).toEqual(["RECOURS_1"]);
    expect(etapesIntermediairesCreees("RECOURS_2_CCJA", ["INSTANCE", "RECOURS_1"])).toEqual([]);
    expect(etapesIntermediairesCreees("RECOURS_2_CCJA", [])).not.toContain("RECOURS_2");
  });
});
