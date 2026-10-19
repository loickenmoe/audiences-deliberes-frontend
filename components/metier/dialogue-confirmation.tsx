"use client";

import { useTranslations } from "next-intl";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Confirmation dialog.
 * Some backend 409 responses are not failures but confirmation requests: `ERR-003` (duplicate
 * assignment) and `ERR-005` (duplicate hearing). The call is then replayed with `?forcer=true` (see
 * `ErreurApi.demandeConfirmation`).
 */
export function DialogueConfirmation({
  ouvert,
  onFermeture,
  onConfirmation,
  titre,
  message,
  libelleConfirmation,
  destructif = false,
  enCours = false,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  onConfirmation: () => void;
  titre: string;
  message: string;
  libelleConfirmation?: string;
  /** Switches the action to the destructive variant (deletions and rejections). */
  destructif?: boolean;
  enCours?: boolean;
}) {
  const t = useTranslations("metier");
  const tc = useTranslations("commun");

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={titre}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={enCours}>
            {tc("annuler")}
          </Button>
          <Button
            variante={destructif ? "destructive" : "principale"}
            onClick={onConfirmation}
            disabled={enCours}
          >
            {libelleConfirmation ?? t("confirmer")}
          </Button>
        </>
      }
    >
      <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{message}</p>
    </Dialog>
  );
}
