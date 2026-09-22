/**
 * @vitest-environment node
 *
 * Garde-fou typographique (QF-48).
 *
 * **Pourquoi ce fichier existe.** En clôturant QF-48 — le remplacement du tiret cadratin « — » par
 * le trait d'union « - » dans tout le texte visible — j'avais écrit noir sur blanc : *« Reste sans
 * garde-fou : je réintroduirai des cadratins en rédigeant normalement. »* C'est arrivé le lendemain,
 * dans un libellé d'archive d'audit, et c'est le porteur du projet qui l'a vu en recette.
 *
 * Une décision de style que rien ne fait respecter n'est pas une décision, c'est un souhait. Ce test
 * est la partie qui manquait : il échoue **avant** la recette, pas pendant.
 *
 * **Ce qu'il ne couvre pas, et pourquoi.** Les commentaires de code et les fichiers `.md` gardent
 * leurs cadratins : ce ne sont pas l'interface, et les balayer noierait dans des milliers de lignes
 * les diffs qui comptent. C'est l'arbitrage rendu en QF-48, et ce test s'y tient.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const CADRATIN = "—";

/**
 * La seule exception, documentée en QF-48 : le placeholder « valeur absente ». Dans une colonne
 * Montant ou Téléphone, un `-` isolé se lit comme un signe moins ou une valeur tronquée, là où le
 * cadratin dit sans ambiguïté « rien à afficher ».
 */
const EXCEPTION_PLACEHOLDER = /"aucuneValeur":\s*"—"/;

/** Les fichiers suivis par git, hors tests : c'est là que vit le texte visible. */
function sourcesVisibles(): string[] {
  return execSync('git ls-files -- "*.ts" "*.tsx"', { encoding: "utf8" })
    .split("\n")
    .map((chemin) => chemin.trim())
    .filter((chemin) => chemin && !chemin.startsWith("tests/"));
}

/**
 * Lignes d'un fichier qui ne sont ni un commentaire ni dans un bloc de commentaire.
 *
 * Le suivi des blocs est nécessaire : une heuristique « la ligne commence par `*` » classait en
 * code les lignes de continuation des commentaires JSX, et avait déjà produit un faux inventaire
 * lors de QF-48.
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
   * Les séparateurs de libellés dans le code — « {reference} — {nom} » — étaient la seconde moitié
   * de QF-48. Un cadratin entouré d'espaces sur une ligne de code est presque toujours un texte
   * affiché ; les commentaires, eux, sont exclus.
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
