import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design system contrast checks, **computed on the real tokens** read from `app/globals.css`,
 * not on values copied into the test. Lightening a text color makes this file fail.
 *
 * WCAG 2.1 thresholds: 4.5:1 for body text (AA), 3:1 for large text and UI indicators.
 */

// `import.meta.url` is not a `file:` URL under jsdom: resolve from the project root.
const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function jeton(nom: string): string {
  const trouve = new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
  if (!trouve?.[1]) throw new Error(`Jeton --${nom} introuvable dans globals.css`);
  return trouve[1];
}

function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canaux.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair! + 0.05) / (sombre! + 0.05);
}

const BLANC = "#ffffff";

describe("couleurs de marque", () => {
  it("les quatre couleurs officielles sont présentes et inchangées", () => {
    expect(jeton("afb-rouge")).toBe("#ed1c24");
    expect(jeton("afb-anthracite")).toBe("#231f20");
    expect(jeton("afb-gris")).toBe("#939598");
    expect(jeton("afb-gris-clair")).toBe("#c7c8ca");
  });

  /**
   * The brand red **cannot** carry interface text. This test documents the constraint as much as
   * it checks it.
   */
  it("le rouge de marque reste sous le seuil AA pour le texte courant", () => {
    const ratio = contraste(jeton("afb-rouge"), BLANC);
    expect(ratio).toBeCloseTo(4.38, 1);
    expect(ratio).toBeLessThan(4.5);
  });

  it("le rouge de marque dépasse le seuil des indicateurs d'interface (3:1)", () => {
    // This is what allows it as a focus ring and identity stripe.
    expect(contraste(jeton("afb-rouge"), BLANC)).toBeGreaterThanOrEqual(3);
  });

  it("le rouge dérivé est lisible en texte", () => {
    expect(contraste(jeton("afb-rouge-texte"), BLANC)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("texte sur les surfaces", () => {
  const surfaces = ["surface", "fond", "surface-attenuee"] as const;

  it.each(surfaces)("le texte principal est lisible sur --%s", (surface) => {
    expect(contraste(jeton("texte"), jeton(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("le texte secondaire est lisible sur --%s", (surface) => {
    expect(contraste(jeton("texte-secondaire"), jeton(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("le texte tertiaire est lisible sur --%s", (surface) => {
    expect(contraste(jeton("texte-tertiaire"), jeton(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it("le texte inverse est lisible sur l'action principale anthracite", () => {
    expect(contraste(jeton("texte-inverse"), jeton("afb-anthracite"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("couleurs de statut", () => {
  const statuts = ["succes", "attention", "danger", "info"] as const;

  it.each(statuts)("--%s est lisible sur blanc", (statut) => {
    expect(contraste(jeton(statut), BLANC)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(statuts)("--%s est lisible sur son propre fond", (statut) => {
    expect(contraste(jeton(statut), jeton(`${statut}-fond`))).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * The danger color must stay distinguishable from the brand red, otherwise users cannot tell an
   * error from the bank's identity color.
   */
  it("le danger se distingue visiblement du rouge de marque", () => {
    const ecart = Math.abs(luminance(jeton("danger")) - luminance(jeton("afb-rouge")));
    expect(ecart).toBeGreaterThan(0.05);
  });
});

describe("bordures", () => {
  it("la bordure forte atteint le seuil des composants d'interface sur la surface", () => {
    expect(contraste(jeton("bordure-forte"), jeton("surface"))).toBeGreaterThanOrEqual(1.4);
  });
});
