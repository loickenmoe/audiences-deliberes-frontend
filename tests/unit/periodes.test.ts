/**
 * @vitest-environment node
 *
 * Raccourcis de période de l'audit (backend Q-113).
 *
 * Les calendriers sont le terrain classique des défauts silencieux : une semaine qui commence le
 * dimanche, un trimestre calculé en « quatre-vingt-dix jours », une archive qui prétend couvrir des
 * jours à venir. Chacun produit un fichier plausible et faux — le pire des résultats, puisqu'il
 * ressemble à une réponse.
 */
import { describe, expect, it } from "vitest";

import { RACCOURCIS_PERIODE, periodeDe } from "@/lib/periodes";

/** Un jeudi : ni lundi ni dimanche, pour que les bornes de semaine soient réellement éprouvées. */
const JEUDI_12_MARS_2026 = new Date(2026, 2, 12);

describe("raccourcis de période", () => {
  it("propose les six raccourcis demandés", () => {
    expect(RACCOURCIS_PERIODE).toEqual(["jour", "semaine", "mois", "trimestre", "semestre", "annee"]);
  });

  /**
   * Aucun raccourci ne dépasse aujourd'hui. Une archive qui couvrirait des jours à venir mentirait
   * sur son contenu, et son empreinte scellerait ce mensonge.
   */
  it("n'anticipe jamais sur des jours à venir", () => {
    for (const raccourci of RACCOURCIS_PERIODE) {
      expect(periodeDe(raccourci, JEUDI_12_MARS_2026).fin).toBe("2026-03-12");
    }
  });

  it("ramène « aujourd'hui » à une journée, bornes incluses", () => {
    expect(periodeDe("jour", JEUDI_12_MARS_2026)).toEqual({ debut: "2026-03-12", fin: "2026-03-12" });
  });

  /** La semaine commence le **lundi**, usage français — le 12 mars 2026 étant un jeudi. */
  it("fait commencer la semaine au lundi", () => {
    expect(periodeDe("semaine", JEUDI_12_MARS_2026).debut).toBe("2026-03-09");
  });

  /**
   * Le dimanche est le piège : `getDay()` y vaut 0, et un décalage naïf le rattacherait à la
   * semaine suivante au lieu de le clore.
   */
  it("rattache le dimanche à la semaine qui s'achève, pas à la suivante", () => {
    const dimanche15Mars = new Date(2026, 2, 15);
    expect(periodeDe("semaine", dimanche15Mars)).toEqual({ debut: "2026-03-09", fin: "2026-03-15" });
  });

  it("part du premier jour du mois", () => {
    expect(periodeDe("mois", JEUDI_12_MARS_2026).debut).toBe("2026-03-01");
  });

  /**
   * « Ce trimestre » désigne le trimestre **calendaire**, pas les quatre-vingt-dix derniers jours :
   * c'est ce qu'un contrôleur entend, et ce qu'il recoupera avec ses propres relevés.
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

  /** Le début ne dépasse jamais la fin : un intervalle inversé serait refusé par le backend. */
  it("ne produit jamais d'intervalle inversé", () => {
    for (const raccourci of RACCOURCIS_PERIODE) {
      const { debut, fin } = periodeDe(raccourci, JEUDI_12_MARS_2026);
      expect(debut <= fin).toBe(true);
    }
  });

  /**
   * Le 1er janvier est le cas limite de quatre raccourcis à la fois : mois, trimestre, semestre et
   * année s'y réduisent à une seule journée.
   */
  it("tient le 1er janvier, où quatre raccourcis se réduisent à un jour", () => {
    const premierJanvier = new Date(2026, 0, 1);
    for (const raccourci of ["mois", "trimestre", "semestre", "annee"] as const) {
      expect(periodeDe(raccourci, premierJanvier)).toEqual({ debut: "2026-01-01", fin: "2026-01-01" });
    }
  });

  /** Les dates partent au format ISO attendu par le backend, sans décalage de fuseau. */
  it("produit des dates ISO sans glissement de fuseau", () => {
    expect(periodeDe("jour", new Date(2026, 0, 1))).toEqual({ debut: "2026-01-01", fin: "2026-01-01" });
    expect(periodeDe("jour", new Date(2026, 11, 31))).toEqual({ debut: "2026-12-31", fin: "2026-12-31" });
  });
});
