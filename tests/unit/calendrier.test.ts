import { describe, expect, it } from "vitest";

import { ajouterMois, debutDePeriode, decalerPeriode, depuisIso, finDePeriode, versIso } from "@/lib/calendrier";
import { formaterDate } from "@/lib/utils";

/**
 * Périodes du calendrier et lecture des dates. Toutes les attentes sont en dates **locales** : la
 * moindre conversion UTC ferait reculer une date d'audience d'un jour à l'ouest de Greenwich.
 */
describe("bornes des périodes", () => {
  it("commence une semaine le lundi, quel que soit le jour donné", () => {
    // Jeudi 10 septembre 2026 → lundi 7.
    expect(versIso(debutDePeriode("HEBDOMADAIRE", new Date(2026, 8, 10)))).toBe("2026-09-07");
    // Un dimanche appartient à la semaine commencée six jours plus tôt, pas à la suivante.
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
    // Le backend ajoute une semaine et interroge BETWEEN : le lundi suivant est inclus.
    expect(versIso(finDePeriode("HEBDOMADAIRE", depuisIso("2026-09-07")))).toBe("2026-09-14");
    expect(versIso(finDePeriode("MENSUELLE", depuisIso("2026-09-01")))).toBe("2026-10-01");
  });

  it("ne déborde pas sur le mois suivant en ajoutant un mois à un 31", () => {
    expect(versIso(ajouterMois(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
  });
});

describe("lecture d'une date seule", () => {
  it("affiche le jour exact, sans décalage par le fuseau horaire", () => {
    // L'attente est construite en date locale : sous l'ancienne lecture (minuit UTC), ce test
    // échouerait dès que le poste est à l'ouest de Greenwich.
    const attendu = new Intl.DateTimeFormat("fr-CM", { dateStyle: "long" }).format(new Date(2026, 8, 10));
    expect(formaterDate("2026-09-10", "fr")).toBe(attendu);
  });

  it("sérialise sans passer par UTC", () => {
    expect(versIso(new Date(2026, 8, 10, 23, 59))).toBe("2026-09-10");
  });
});
