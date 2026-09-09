"use client";

import { useTranslations } from "next-intl";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Dialogue de confirmation.
 *
 * **Motif central du domaine** : le backend refuse certaines opérations par un 409 qui n'est pas un
 * échec mais une **demande de confirmation** — `ERR-003` (doublon d'affectation) et `ERR-005`
 * (doublon d'audience). L'appel se rejoue alors avec `?forcer=true`.
 *
 * Présenter ces réponses comme des erreurs bloquerait deux parcours métier parfaitement légitimes :
 * un dossier peut légitimement être réaffecté au même juriste, une audience replanifiée le même
 * jour. C'est pourquoi `ErreurApi.demandeConfirmation` existe.
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
  /** Bascule l'action en variante destructive : suppressions et rejets. */
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
