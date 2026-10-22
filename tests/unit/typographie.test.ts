/**
 * @vitest-environment node
 *
 * Typography guard: visible text uses the hyphen "-", never the em dash "—".
 *
 * Code comments and `.md` files are out of scope: they are not part of the interface.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const CADRATIN = "—";

/**
 * The only exception: the "missing value" placeholder. In an Amount or Phone column a lone `-` reads
 * as a minus sign or a truncated value, whereas the em dash clearly means "nothing to show".
 */
const EXCEPTION_PLACEHOLDER = /"aucuneValeur":\s*"—"/;

/** Git-tracked files, excluding tests: that is where visible text lives. */
function sourcesVisibles(): string[] {
  return execSync('git ls-files -- "*.ts" "*.tsx"', { encoding: "utf8" })
    .split("\n")
    .map((chemin) => chemin.trim())
    .filter((chemin) => chemin && !chemin.startsWith("tests/"));
}

/**
 * Lines of a file that are neither a comment nor inside a comment block. Block tracking is needed:
 * a "line starts with `*`" heuristic would classify JSX comment continuation lines as code.
 */
function lignesDeCode(contenu: string): { numero: number; texte: string }[] {
  const resultat: { numero: number; texte: string }[] = [];
  let dansUnBloc = false;

  contenu.split("\n").forEach((ligne, index) => {
    const nu = ligne.trim();
    const ouvre = nu.includes("/*") && !nu.slice(nu.indexOf("/*")).includes("*/");
    const estCommentaire =
      dansUnBloc || nu.startsWith("*") || nu.startsWith("//") || nu.startsWith("/*") || nu.startsWith("{/*");

    if (!estCommentaire) resultat.push({ numero: index + 1, texte: ligne });

    if (ouvre) dansUnBloc = true;
    if (dansUnBloc && nu.includes("*/")) dansUnBloc = false;
  });

  return resultat;
}

describe("typographie du texte visible (QF-48)", () => {
  it.each(["messages/fr.json", "messages/en.json"])(
    "%s ne contient aucun cadratin, hormis le placeholder documenté",
    (chemin) => {
      const fautifs = readFileSync(chemin, "utf8")
        .split("\n")
        .map((ligne, index) => ({ numero: index + 1, ligne }))
        .filter(({ ligne }) => ligne.includes(CADRATIN) && !EXCEPTION_PLACEHOLDER.test(ligne))
        .map(({ numero, ligne }) => `${chemin}:${numero} ${ligne.trim()}`);

      expect(fautifs, "libellés portant encore un tiret cadratin").toEqual([]);
    },
  );

  /**
   * Label separators in code ("{reference} — {nom}"): an em dash surrounded by spaces on a code
   * line is almost always displayed text. Comments are excluded.
   */
  it("aucun séparateur en cadratin dans les chaînes du code", () => {
    const fautifs: string[] = [];

    for (const chemin of sourcesVisibles()) {
      const contenu = readFileSync(chemin, "utf8");
      if (!contenu.includes(` ${CADRATIN} `)) continue;

      for (const { numero, texte } of lignesDeCode(contenu)) {
        if (texte.includes(` ${CADRATIN} `)) fautifs.push(`${chemin}:${numero} ${texte.trim()}`);
      }
    }

    expect(fautifs, "séparateurs affichés portant encore un tiret cadratin").toEqual([]);
  });
});
