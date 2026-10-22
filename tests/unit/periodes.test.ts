/**
 * @vitest-environment node
 *
 * Audit period shortcuts. Calendars breed silent bugs (a week starting on Sunday, a quarter computed
 * as 90 days, an archive covering future days), each producing a plausible but wrong file.
 */
import { describe, expect, it } from "vitest";

import { RACCOURCIS_PERIODE, periodeDe } from "@/lib/periodes";

/** A Thursday, neither Monday nor Sunday, so week bounds are really tested. */
const JEUDI_12_MARS_2026 = new Date(2026, 2, 12);

describe("raccourcis de période", () => {
  it("propose les six raccourcis demandés", () => {
    expect(RACCOURCIS_PERIODE).toEqual(["jour", "semaine", "mois", "trimestre", "semestre", "annee"]);
  });

  /**
   * No shortcut goes past today: an archive covering future days would misstate its content, and
   * its fingerprint would seal it.
   */
  it("n'anticipe jamais sur des jours à venir", () => {
    for (const raccourci of RACCOURCIS_PERIODE) {
      expect(periodeDe(raccourci, JEUDI_12_MARS_2026).fin).toBe("2026-03-12");
    }
  });

  it("ramène « aujourd'hui » à une journée, bornes incluses", () => {
    expect(periodeDe("jour", JEUDI_12_MARS_2026)).toEqual({ debut: "2026-03-12", fin: "2026-03-12" });
  });

  /** The week starts on **Monday** (French convention); 12 March 2026 is a Thursday. */
  it("fait commencer la semaine au lundi", () => {
    expect(periodeDe("semaine", JEUDI_12_MARS_2026).debut).toBe("2026-03-09");
  });

  /**
   * Sunday is the trap: `getDay()` returns 0, and a naive offset would attach it to the next week
   * instead of ending the current one.
   */
  it("rattache le dimanche à la semaine qui s'achève, pas à la suivante", () => {
    const dimanche15Mars = new Date(2026, 2, 15);
    expect(periodeDe("semaine", dimanche15Mars)).toEqual({ debut: "2026-03-09", fin: "2026-03-15" });
  });

  it("part du premier jour du mois", () => {
    expect(periodeDe("mois", JEUDI_12_MARS_2026).debut).toBe("2026-03-01");
  });

  /**
   * "This quarter" means the **calendar** quarter, not the last ninety days: that is what an
   * auditor expects and will cross-check.
   */
  it("part du premier jour du trimestre calendaire", () => {
    expect(periodeDe("trimestre", JEUDI_12_MARS_2026).debut).toBe("2026-01-01");
    expect(periodeDe("trimestre", new Date(2026, 7, 20)).debut).toBe("2026-07-01");
    expect(periodeDe("trimestre", new Date(2026, 11, 31)).debut).toBe("2026-10-01");
  });

  it("coupe le semestre au 1er janvier et au 1er juillet", () => {
    expect(periodeDe("semestre", new Date(2026, 5, 30)).debut).toBe("2026-01-01");
    expect(periodeDe("semestre", new Date(2026, 6, 1)).debut).toBe("2026-07-01");
  });

  it("part du premier jour de l'année", () => {
    expect(periodeDe("annee", JEUDI_12_MARS_2026).debut).toBe("2026-01-01");
  });

  /** Start never exceeds end: the backend would reject an inverted range. */
  it("ne produit jamais d'intervalle inversé", () => {
    for (const raccourci of RACCOURCIS_PERIODE) {
      const { debut, fin } = periodeDe(raccourci, JEUDI_12_MARS_2026);
      expect(debut <= fin).toBe(true);
    }
  });

  /**
   * 1 January is the edge case of four shortcuts at once: month, quarter, half-year and year all
   * reduce to a single day.
   */
  it("tient le 1er janvier, où quatre raccourcis se réduisent à un jour", () => {
    const premierJanvier = new Date(2026, 0, 1);
    for (const raccourci of ["mois", "trimestre", "semestre", "annee"] as const) {
      expect(periodeDe(raccourci, premierJanvier)).toEqual({ debut: "2026-01-01", fin: "2026-01-01" });
    }
  });

  /** Dates are sent in the ISO format expected by the backend, without time zone shift. */
  it("produit des dates ISO sans glissement de fuseau", () => {
    expect(periodeDe("jour", new Date(2026, 0, 1))).toEqual({ debut: "2026-01-01", fin: "2026-01-01" });
    expect(periodeDe("jour", new Date(2026, 11, 31))).toEqual({ debut: "2026-12-31", fin: "2026-12-31" });
  });
});
