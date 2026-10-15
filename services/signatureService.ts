import { apiClient } from "@/lib/api/client";
import type { Signature } from "@/types/domaine";

/**
 * Ma signature enregistrée (N8, métier du 2026-10-06).
 *
 * **Toujours la mienne, jamais celle d'un autre.** Aucun appel ne prend d'identifiant : le serveur
 * travaille sur la session. C'est la seule forme où une signature garde un sens - celle qu'un tiers
 * détient ne vaut déjà plus rien. La lettre de constitution, elle, appose celle du signataire côté
 * serveur, sans que l'image transite par un écran.
 *
 * **Ce qu'elle est.** Un confort de présentation : la lettre part avec l'image au lieu d'un nom à
 * signer à la main. Elle n'apporte aucune valeur probante supplémentaire - ce qui fait preuve, c'est
 * la trace horodatée de qui a signé.
 */
export const signatureService = {
  /** L'état : déposée ou non, et depuis quand. Pas l'image. */
  mienne: async (): Promise<Signature> => {
    const { data } = await apiClient.get<Signature>("/utilisateurs/moi/signature");
    return data;
  },

  /**
   * L'image, pour l'aperçu.
   *
   * Rendue en `Blob` et non en adresse directe : l'appel porte le jeton, et une balise
   * `<img src>` pointant sur l'API ne l'emporterait pas. C'est aussi ce qu'attend
   * `ApercuFichier`, qui se charge lui-même de l'objet-URL et de sa libération.
   */
  monImage: async (): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>("/utilisateurs/moi/signature/image", {
      responseType: "blob",
    });
    return data;
  },

  /** Dépose ou remplace. PNG ou JPEG, 200 Ko au plus - ce que la lettre sait apposer. */
  deposer: async (fichier: File): Promise<Signature> => {
    const corps = new FormData();
    corps.append("fichier", fichier);
    const { data } = await apiClient.put<Signature>("/utilisateurs/moi/signature", corps, {
      /*
       * Le client déclare `application/json` par défaut. Sans ce type, le navigateur n'écrit pas
       * la frontière des parties et le serveur ne voit aucun fichier - le dépôt répondait 500.
       * C'est la règle de tous les autres envois de fichier de l'application (GED, frais, CR).
       */
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /**
   * Retire ma signature.
   *
   * Les lettres déjà signées ne changent pas : leur PDF est produit et archivé. Et la preuve de la
   * signature n'a jamais été cette image.
   */
  retirer: async (): Promise<void> => {
    await apiClient.delete("/utilisateurs/moi/signature");
  },
};
