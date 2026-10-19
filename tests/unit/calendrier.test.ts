import { describe, expect, it } from "vitest";

import { ajouterMois, debutDePeriode, decalerPeriode, depuisIso, finDePeriode, versIso } from "@/lib/calendrier";
import { formaterDate } from "@/lib/utils";

/**
 * Calendar periods and date parsing. All expectations use **local** dates: any UTC conversion
 * would shift a hearing date back one day west of Greenwich.
 */
describe("bornes des périodes", () => {
  it("commence une semaine le lundi, quel que soit le jour donné", () => {
    // Thursday 10 September 2026 → Monday 7.
    expect(versIso(debutDePeriode("HEBDOMADAIRE", new Date(2026, 8, 10)))).toBe("2026-09-07");
    // A Sunday belongs to the week that started six days earlier, not the next one.
    expect(versIso(debutDePeriode("HEBDOMADAIRE", new Date(2026, 8, 13)))).toBe("2026-09-07");
  });

  it("commence un mois le 1er, un trimestre le 1er du trimestre civil", () => {
    expect(versIso(debutDePeriode("MENSUELLE", new Date(2026, 8, 10)))).toBe("2026-09-01");
    expect(versIso(debutDePeriode("TRIMESTRIELLE", new Date(2026, 8, 10)))).toBe("2026-07-01");
    expect(versIso(debutDePeriode("TRIMESTRIELLE", new Date(2026, 0, 31)))).toBe("2026-01-01");
  });

  it("navigue d'une période entière dans les deux sens", () => {
    const lundi = depuisIso("2026-09-07");
    expect(versIso(decalerPeriode("HEBDOMADAIRE", lundi, 1))).toBe("2026-09-14");
    expect(versIso(decalerPeriode("HEBDOMADAIRE", lundi, -1))).toBe("2026-08-31");
    expect(versIso(decalerPeriode("TRIMESTRIELLE", depuisIso("2026-07-01"), 1))).toBe("2026-10-01");
  });

  it("annonce la même fin que le backend, borne incluse (QF-31)", () => {
    // The backend adds one week and queries with BETWEEN: the following Monday is included.
    expect(versIso(finDePeriode("HEBDOMADAIRE", depuisIso("2026-09-07")))).toBe("2026-09-13");
    expect(versIso(finDePeriode("MENSUELLE", depuisIso("2026-09-01")))).toBe("2026-09-30");
    expect(versIso(finDePeriode("TRIMESTRIELLE", depuisIso("2026-09-01")))).toBe("2026-11-30");
    // The next period starts the following day, never the same day.
    expect(versIso(decalerPeriode("HEBDOMADAIRE", depuisIso("2026-09-07"), 1))).toBe("2026-09-14");
  });

  it("ne déborde pas sur le mois suivant en ajoutant un mois à un 31", () => {
    expect(versIso(ajouterMois(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
  });
});

describe("lecture d'une date seule", () => {
  it("affiche le jour exact, sans décalage par le fuseau horaire", () => {
    // The expectation is built as a local date: parsing as UTC midnight would fail west of Greenwich.
    const attendu = new Intl.DateTimeFormat("fr-CM", { dateStyle: "long" }).format(new Date(2026, 8, 10));
    expect(formaterDate("2026-09-10", "fr")).toBe(attendu);
  });

  it("sérialise sans passer par UTC", () => {
    expect(versIso(new Date(2026, 8, 10, 23, 59))).toBe("2026-09-10");
  });
});
