"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";

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
 *
 * **Identifiants uniques par instance (`useId`).** Un `<dialog>` fermé reste dans le DOM : la fiche
 * dossier en monte plusieurs à la fois. Avec un identifiant fixe, `aria-labelledby` de chacune
 * pointait vers le **premier** titre du document — la confirmation d'affectation s'annonçait
 * « Modifier l'affectation ». Découvert par un parcours e2e de F7, le 2026-09-10.
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
  const idTitre = useId();
  const idDescription = useId();

  useEffect(() => {
    const dialogue = reference.current;
    if (!dialogue) return;

    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  }, [ouvert]);

  return (
    <dialog
      ref={reference}
      aria-labelledby={idTitre}
      aria-describedby={description ? idDescription : undefined}
      /*
       * `close` couvre Échap et le bouton de fermeture : une seule voie de sortie à gérer.
       *
       * Mais le navigateur émet **aussi** `close` quand c'est le programme qui ferme — quand
       * `ouvert` passe à faux. Relayer ce cas rappelait `onFermeture` en cascade : masquer une
       * modale pour afficher sa confirmation refermait tout le parcours, confirmation comprise
       * (ERR-003 de l'affectation, F7). Seule une fermeture décidée par l'utilisateur est relayée —
       * c'est-à-dire pendant que le parent la croit encore ouverte.
       */
      onClose={() => {
        if (ouvert) onFermeture();
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-bordure bg-surface p-0 text-texte shadow-[var(--ombre-elevee)] backdrop:bg-[rgb(35_31_32_/_0.45)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-bordure px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2
            id={idTitre}
            className="text-balance text-[length:var(--taille-lg)] font-semibold tracking-tight"
          >
            {titre}
          </h2>
          {description ? (
            <p id={idDescription} className="text-[length:var(--taille-sm)] text-texte-secondaire">
              {description}
            </p>
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
