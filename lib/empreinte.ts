/**
 * Empreintes SHA-256 côté navigateur (backend Q-114).
 *
 * **Pourquoi le calcul se fait ici.** Vérifier qu'un fichier correspond à une archive n'exige pas
 * d'envoyer le fichier : il suffit d'en comparer l'empreinte. Un document d'audit n'a aucune raison
 * de traverser le réseau pour être comparé à lui-même — il ne quitte jamais le poste.
 */

/**
 * Calcule le SHA-256 d'un fichier, en hexadécimal minuscule.
 *
 * `crypto.subtle` n'existe qu'en **contexte sécurisé** — HTTPS, ou `localhost`. Sur une page servie
 * en HTTP simple, l'appel est absent et non pas en échec : on le signale explicitement plutôt que
 * de laisser une exception illisible remonter jusqu'à l'utilisateur.
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

/**
 * Met une empreinte en blocs de huit, pour qu'elle se lise.
 *
 * Un humain ne compare jamais soixante-quatre caractères d'affilée : il compare les premiers et les
 * derniers. Les grouper est ce qui rend ce geste possible — et c'est l'usage constant partout où
 * l'on affiche une empreinte, des clés GPG aux adresses de portefeuille.
 */
export function grouperEmpreinte(empreinte: string, parLigne = 4): string[] {
  const blocs = empreinte.match(/.{1,8}/g) ?? [];
  const lignes: string[] = [];
  for (let i = 0; i < blocs.length; i += parLigne) {
    lignes.push(blocs.slice(i, i + parLigne).join(" "));
  }
  return lignes;
}

/** Vrai si la chaîne a bien la forme d'un SHA-256 hexadécimal. */
export function estUneEmpreinte(valeur: string): boolean {
  return /^[0-9a-f]{64}$/.test(valeur.trim().toLowerCase());
}
