import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Retrouver une ligne dans une file de travail, quelle que soit sa profondeur.
 *
 * **Le défaut que cette aide corrige, et qui a frappé quatre parcours le même jour.** Les files de
 * travail de l'application — publications à valider, demandes de suppression, constitutions à
 * signer — sont **FIFO** : la plus ancienne en tête. C'est le comportement voulu, et le bon : on
 * traite d'abord ce qui attend depuis le plus longtemps. Elles sont paginées à dix lignes.
 *
 * Un test qui dépose une pièce puis la cherche « dans la file » la cherchait en réalité **sur la
 * première page**. Comme elle vient d'arriver, elle est la dernière : l'assertion ne tenait que tant
 * que la file comptait moins de dix éléments. Le jour où les files ont franchi ce seuil — les
 * exécutions successives y laissent des éléments jamais traités — quatre parcours sont tombés d'un
 * coup, en expirant au bout de quatre minutes, **sans qu'une seule ligne de code produit n'ait
 * changé**.
 *
 * C'était donc un test qui mesurait son environnement et non le produit. Parcourir les pages rend
 * l'assertion vraie pour ce qu'elle prétend vérifier : « la pièce est bien arrivée dans la file ».
 *
 * On ne règle **pas** ce genre de défaut en augmentant la taille de page : cinquante n'est qu'un
 * seuil plus lointain, et le test retomberait le jour où la file le franchirait à son tour.
 */
export async function ligneDansLaFile(page: Page, motif: RegExp | string): Promise<Locator> {
  const ligne = page.getByRole("row", { name: typeof motif === "string" ? new RegExp(motif) : motif });
  const suivante = page.getByRole("button", { name: "Page suivante" });
  const indicateur = page.getByText(/^Page \d+ sur \d+$/);

  // Borne haute : une file de plus de cinquante pages signale un autre problème, et un échec
  // explicite vaut mieux qu'une boucle qui expire en silence.
  for (let pagesRestantes = 50; pagesRestantes > 0; pagesRestantes--) {
    /*
     * `count()` répond immédiatement, sans patienter. Or le tableau se repeuple **après** que
     * l'indicateur de page a changé : interroger le compte aussitôt revient à lire la page pendant
     * qu'elle se dessine, et à conclure à une absence. On laisse donc à chaque page un délai court
     * mais réel — court parce qu'on en visitera peut-être plusieurs.
     */
    try {
      await expect(ligne.first()).toBeVisible({ timeout: 5_000 });
      return ligne.first();
    } catch {
      // Pas sur cette page : on continue.
    }
    if ((await suivante.count()) === 0 || (await suivante.isDisabled())) break;

    const position = await indicateur.textContent();
    await suivante.click();
    // On attend que l'indicateur ait réellement changé avant de relire : sans cela on relirait la
    // page précédente, et le parcours n'avancerait pas.
    await expect(indicateur).not.toHaveText(position ?? "", { timeout: 30_000 });
  }

  throw new Error(`Aucune ligne correspondant à ${motif} dans cette file, toutes pages parcourues`);
}
