/**
 * Browser-side SHA-256 fingerprints: checking a file against an archive only needs its hash, so the
 * audit document never leaves the workstation.
 */

/**
 * Computes a file's SHA-256 as lowercase hex.
 *
 * `crypto.subtle` only exists in a secure context (HTTPS or `localhost`); its absence is reported
 * explicitly instead of letting an obscure exception surface.
 */
export async function empreinteFichier(fichier: File): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("CONTEXTE_NON_SECURISE");
  }
  const octets = await fichier.arrayBuffer();
  const condense = await crypto.subtle.digest("SHA-256", octets);
  return Array.from(new Uint8Array(condense))
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("");
}

/** Splits a fingerprint into blocks of eight so a human can compare it. */
export function grouperEmpreinte(empreinte: string, parLigne = 4): string[] {
  const blocs = empreinte.match(/.{1,8}/g) ?? [];
  const lignes: string[] = [];
  for (let i = 0; i < blocs.length; i += parLigne) {
    lignes.push(blocs.slice(i, i + parLigne).join(" "));
  }
  return lignes;
}

/** True if the string looks like a hex SHA-256. */
export function estUneEmpreinte(valeur: string): boolean {
  return /^[0-9a-f]{64}$/.test(valeur.trim().toLowerCase());
}
