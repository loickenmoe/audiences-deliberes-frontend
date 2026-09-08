import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Vérification des contrastes du design system, **calculée sur les jetons réels** lus dans
 * `app/globals.css` — pas sur des valeurs recopiées dans le test. Si quelqu'un éclaircit une
 * couleur de texte, ce fichier échoue.
 *
 * Seuils WCAG 2.1 : 4,5:1 pour le texte courant (AA), 3:1 pour le texte large et les indicateurs
 * d'interface.
 */

// `import.meta.url` n'est pas une URL `file:` sous jsdom : on part de la racine du projet.
const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Lit un jeton `--nom: #rrggbb;` dans la feuille de style. */
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
   * Le fait qui fonde toute la direction visuelle : le rouge de marque **ne peut pas** porter le
   * texte de l'interface. Ce test documente la contrainte autant qu'il la vérifie.
   */
  it("le rouge de marque reste sous le seuil AA pour le texte courant", () => {
    const ratio = contraste(jeton("afb-rouge"), BLANC);
    expect(ratio).toBeCloseTo(4.38, 1);
    expect(ratio).toBeLessThan(4.5);
  });

  it("le rouge de marque dépasse le seuil des indicateurs d'interface (3:1)", () => {
    // C'est ce qui l'autorise comme anneau de focus et comme filet d'identité.
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
   * Le danger doit rester distinguable du rouge de marque : sans cela, dans une interface pleine
   * de rejets et de suppressions, l'utilisateur ne sait plus si une couleur signale une erreur ou
   * simplement l'identité de la banque.
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
