import { apiClient } from "@/lib/api/client";
import type { Signature } from "@/types/domaine";

/**
 * The current user's stored signature. No call takes an id: the server works on the session, so a
 * user can only ever manage their own. The constitution letter embeds the signer's image
 * server-side. The image is presentational only; proof is the timestamped signing record.
 */
export const signatureService = {
  /** State only (uploaded or not, and since when), not the image. */
  mienne: async (): Promise<Signature> => {
    const { data } = await apiClient.get<Signature>("/utilisateurs/moi/signature");
    return data;
  },

  /**
   * The image for preview, as a `Blob`: the call carries the token, which an `<img src>` pointing
   * at the API would not. `ApercuFichier` manages the object URL itself.
   */
  monImage: async (): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>("/utilisateurs/moi/signature/image", {
      responseType: "blob",
    });
    return data;
  },

  /** Uploads or replaces. PNG or JPEG, 200 KB max. */
  deposer: async (fichier: File): Promise<Signature> => {
    const corps = new FormData();
    corps.append("fichier", fichier);
    const { data } = await apiClient.put<Signature>("/utilisateurs/moi/signature", corps, {
      // The client defaults to `application/json`; without this header the server receives no file.
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /** Removes the signature. Already signed letters are unaffected: their PDF is archived. */
  retirer: async (): Promise<void> => {
    await apiClient.delete("/utilisateurs/moi/signature");
  },
};
