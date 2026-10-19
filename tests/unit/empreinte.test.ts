/**
 * @vitest-environment node
 *
 * Browser-side SHA-256 fingerprints. The **computation** must match `sha256sum` exactly, otherwise
 * nobody could verify it. The **grouping** is only for readability, so people actually compare values.
 */
import { describe, expect, it } from "vitest";

import { empreinteFichier, estUneEmpreinte, grouperEmpreinte } from "@/lib/empreinte";

/** A minimal `File`, enough for `arrayBuffer()`. */
function fichier(contenu: string): File {
  return new File([contenu], "audit.pdf", { type: "application/pdf" });
}

describe("calcul d'empreinte", () => {
  /**
   * The well-known SHA-256 of "abc". If this value changes, the test is not the one at fault.
   */
  it("donne le même résultat que n'importe quel outil standard", async () => {
    await expect(empreinteFichier(fichier("abc"))).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  /** SHA-256 of the empty string: the edge case always forgotten. */
  it("traite un fichier vide sans broncher", async () => {
    await expect(empreinteFichier(fichier(""))).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  /**
   * Avalanche effect: changing **a single character** yields an unrelated fingerprint, which rules
   * out silently altering an archive.
   */
  it("change entièrement pour un seul caractère modifié", async () => {
    const [avant, apres] = await Promise.all([
      empreinteFichier(fichier("Audit du 1er septembre")),
      empreinteFichier(fichier("Audit du 2e septembre")),
    ]);

    expect(avant).not.toBe(apres);
    const communs = [...avant].filter((caractere, index) => caractere === apres[index]).length;
    // Out of 64 positions a few match by chance; nothing resembling a relation.
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

  /** Grouping must never alter the value: it is presentation, not transformation. */
  it("ne perd ni n'ajoute aucun caractère", () => {
    const empreinte = "a".repeat(64);

    expect(grouperEmpreinte(empreinte).join("").replace(/ /g, "")).toBe(empreinte);
  });

  it("reconnaît une empreinte valide et rejette ce qui n'en est pas une", () => {
    expect(estUneEmpreinte("A".repeat(64))).toBe(true); // case does not change the value
    expect(estUneEmpreinte(" " + "b".repeat(64) + " ")).toBe(true);
    expect(estUneEmpreinte("z".repeat(64))).toBe(false);
    expect(estUneEmpreinte("abc")).toBe(false);
    expect(estUneEmpreinte("")).toBe(false);
  });
});
