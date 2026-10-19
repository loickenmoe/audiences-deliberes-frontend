"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Modal dialog built on the native `<dialog>` element.
 *
 * Deliberately no library: `showModal()` natively provides focus trapping, Escape to close,
 * background inertness and the ARIA role.
 *
 * The close button calls `close()` rather than using a `<form method="dialog">`: the modal is often
 * rendered inside a parent form, and nested forms are invalid HTML.
 *
 * **Ids are unique per instance (`useId`).** A closed `<dialog>` stays in the DOM and the case file
 * mounts several at once; with a fixed id, every `aria-labelledby` would point to the **first** title.
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
       * `close` covers Escape and the close button: a single exit path to handle.
       *
       * The browser **also** fires `close` when the program closes it (`ouvert` turns false).
       * Relaying that would call `onFermeture` in cascade, e.g. hiding a modal to show its
       * confirmation would close the whole flow. Only a user-initiated close is relayed, i.e. while
       * the parent still considers it open.
       */
      onClose={(evenement) => {
        /*
         * **And only the closing of THIS dialog.** React relays to this handler the `close` of a
         * **nested** dialog (e.g. a file preview rendered inside the form that uploads it), which
         * would otherwise close the whole form and lose its input.
         */
        if (evenement.target !== reference.current) return;
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

        {/*
          A plain button, not a `<form method="dialog">`: the modal is often rendered inside a
          form (a document preview within the case form), and nested forms are invalid HTML. When
          server-rendered, the inner form would be dropped and this button would submit the parent
          form. `close()` fires the same `close` event, so closing follows the same path.
        */}
        <button
          type="button"
          onClick={() => reference.current?.close()}
          aria-label={t("fermer")}
          className="rounded p-1 text-texte-tertiaire transition-colors hover:bg-surface-attenuee hover:text-texte"
        >
          <X size={16} aria-hidden />
        </button>
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
