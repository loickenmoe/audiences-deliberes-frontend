/**
 * @vitest-environment node
 *
 * Empreintes SHA-256 côté navigateur (backend Q-114).
 *
 * Deux choses sont éprouvées ici, et elles n'ont pas le même poids. Le **calcul** doit donner
 * exactement ce que donnerait `sha256sum` : c'est toute la valeur d'une empreinte que d'être
 * universelle, et une implémentation qui dériverait ne serait vérifiable par personne. Le
 * **groupage**, lui, ne relève que de la lisibilité — mais c'est ce qui décide si quelqu'un compare
 * vraiment, ou fait semblant.
 */
import { describe, expect, it } from "vitest";

import { empreinteFichier, estUneEmpreinte, grouperEmpreinte } from "@/lib/empreinte";

/** Un `File` minimal, suffisant pour `arrayBuffer()`. */
function fichier(contenu: string): File {
  return new File([contenu], "audit.pdf", { type: "application/pdf" });
}

describe("calcul d'empreinte", () => {
  /**
   * Le SHA-256 de « abc », connu et vérifiable hors de ce projet. Si cette valeur change, ce n'est
   * pas le test qui a tort.
   */
  it("donne le même résultat que n'importe quel outil standard", async () => {
    await expect(empreinteFichier(fichier("abc"))).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  /** Le SHA-256 de la chaîne vide : le cas limite qu'on oublie toujours. */
  it("traite un fichier vide sans broncher", async () => {
    await expect(empreinteFichier(fichier(""))).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  /**
   * Effet d'avalanche : **un seul caractère** change, et l'empreinte n'a plus rien de commun. C'est
   * la propriété qui interdit le « presque pareil » — et donc la retouche discrète d'une archive.
   */
  it("change entièrement pour un seul caractère modifié", async () => {
    const [avant, apres] = await Promise.all([
      empreinteFichier(fichier("Audit du 1er septembre")),
      empreinteFichier(fichier("Audit du 2e septembre")),
    ]);

    expect(avant).not.toBe(apres);
    const communs = [...avant].filter((caractere, index) => caractere === apres[index]).length;
    // Sur 64 positions, le hasard en fait coïncider quelques-unes ; rien qui ressemble à une parenté.
    expect(communs).toBeLessThan(16);
  });

  it("rend toujours 64 caractères hexadécimaux minuscules", async () => {
    const empreinte = await empreinteFichier(fichier("n'importe quoi"));

    expect(empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(estUneEmpreinte(empreinte)).toBe(true);
  });
});

describe("lecture d'une empreinte", () => {
  it("groupe par blocs de huit, quatre par ligne", () => {
    const empreinte = "59bde5c1748ce074555d0329ec96fbfb0cf270815292619023866c8fd04b807e";

    expect(grouperEmpreinte(empreinte)).toEqual([
      "59bde5c1 748ce074 555d0329 ec96fbfb",
      "0cf27081 52926190 23866c8f d04b807e",
    ]);
  });

  /** Le groupage ne doit jamais altérer la valeur : c'est une présentation, pas une transformation. */
  it("ne perd ni n'ajoute aucun caractère", () => {
    const empreinte = "a".repeat(64);

    expect(grouperEmpreinte(empreinte).join("").replace(/ /g, "")).toBe(empreinte);
  });

  it("reconnaît une empreinte valide et rejette ce qui n'en est pas une", () => {
    expect(estUneEmpreinte("A".repeat(64))).toBe(true); // la casse ne change rien à la valeur
    expect(estUneEmpreinte(" " + "b".repeat(64) + " ")).toBe(true);
    expect(estUneEmpreinte("z".repeat(64))).toBe(false);
    expect(estUneEmpreinte("abc")).toBe(false);
    expect(estUneEmpreinte("")).toBe(false);
  });
});
