"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Boîte de dialogue modale, bâtie sur l'élément natif `<dialog>`.
 *
 * Choix délibéré plutôt qu'une bibliothèque : `showModal()` fournit nativement le piégeage du focus,
 * la fermeture par Échap, l'inertie de l'arrière-plan et le rôle ARIA. Une dépendance de plus
 * n'apporterait rien ici et alourdirait le paquet.
 *
 * Le `<form method="dialog">` du bouton de fermeture est le mécanisme natif : il ferme sans
 * JavaScript, donc même si l'hydratation n'est pas terminée.
 */
export function Dialog({
  ouvert,
  onFermeture,
  titre,
  description,
  children,
  pied,
  className,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  titre: string;
  description?: string;
  children?: ReactNode;
  pied?: ReactNode;
  className?: string;
}) {
  const reference = useRef<HTMLDialogElement>(null);
  const t = useTranslations("commun");

  useEffect(() => {
    const dialogue = reference.current;
    if (!dialogue) return;

    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  }, [ouvert]);

  return (
    <dialog
      ref={reference}
      aria-labelledby="titre-dialogue"
      // `close` couvre Échap et le clic sur le fond : une seule voie de sortie à gérer.
      onClose={onFermeture}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-bordure bg-surface p-0 text-texte shadow-[var(--ombre-elevee)] backdrop:bg-[rgb(35_31_32_/_0.45)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-bordure px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2
            id="titre-dialogue"
            className="text-balance text-[length:var(--taille-lg)] font-semibold tracking-tight"
          >
            {titre}
          </h2>
          {description ? (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{description}</p>
          ) : null}
        </div>

        <form method="dialog">
          <button
            type="submit"
            aria-label={t("fermer")}
            className="rounded p-1 text-texte-tertiaire transition-colors hover:bg-surface-attenuee hover:text-texte"
          >
            <X size={16} aria-hidden />
          </button>
        </form>
      </div>

      {children ? <div className="px-5 py-4">{children}</div> : null}

      {pied ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-bordure px-5 py-4">
          {pied}
        </div>
      ) : null}
    </dialog>
  );
}
