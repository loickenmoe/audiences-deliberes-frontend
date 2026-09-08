import { describe, expect, it } from "vitest";

import { cn, formaterDate, formaterFcfa } from "@/lib/utils";

describe("formaterFcfa", () => {
  it("formate sans décimale le seuil par défaut du domaine", () => {
    // Espaces insécables selon la locale : on compare sur les chiffres et la devise.
    const rendu = formaterFcfa(50_000_000).replace(/\s/g, " ");
    expect(rendu).toContain("50 000 000");
    expect(rendu).toMatch(/XAF|FCFA/);
  });

  it("affiche un tiret cadratin pour une valeur absente", () => {
    expect(formaterFcfa(null)).toBe("—");
    expect(formaterFcfa(undefined)).toBe("—");
  });
});

describe("formaterDate", () => {
  it("rend une date ISO du backend en français", () => {
    expect(formaterDate("2026-09-08")).toContain("2026");
  });

  it("tolère une valeur absente ou invalide", () => {
    expect(formaterDate(null)).toBe("—");
    expect(formaterDate("pas-une-date")).toBe("—");
  });
});

describe("cn", () => {
  it("résout les conflits de classes Tailwind", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
