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
 * Le bouton de fermeture appelle `close()`. Il était auparavant un `<form method="dialog">`,
 * mécanisme natif qui fermait sans JavaScript ; mais une modale ne s'ouvre que par `showModal()`,
 * appelé après l'hydratation, et ne peut donc jamais être ouverte sans JavaScript. Ce formulaire
 * s'imbriquait en revanche dans celui du parent quand la modale y était rendue, ce qu'HTML interdit
 * (aperçu d'une pièce dans le formulaire du dossier, 2026-09-22).
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
      onClose={(evenement) => {
        /*
         * **Et seulement la fermeture de CETTE boîte** (QF-63). React relaie à ce gestionnaire le
         * `close` d'une boîte **imbriquée** - l'aperçu d'un fichier rendu dans le formulaire qui le
         * charge. La croix de l'aperçu emportait donc le formulaire entier, et toute la saisie avec
         * lui, là où son bouton « Fermer » - qui passe par l'état React - ne refermait que l'aperçu.
         * Deux voies de sortie pour un même geste, et une seule était juste.
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
          Un simple bouton, et non un `<form method="dialog">` : la modale est souvent rendue dans
          un formulaire (l'aperçu d'une pièce, dans celui du dossier), et un formulaire imbriqué est
          interdit en HTML. Rendu par le serveur, le formulaire intérieur serait supprimé, et ce
          bouton enverrait le formulaire parent. `close()` émet le même événement `close` : la
          fermeture suit exactement la même voie qu'avant.
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
