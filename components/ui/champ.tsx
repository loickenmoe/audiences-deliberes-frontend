import { cloneElement, isValidElement } from "react";
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

const BASE =
  "w-full rounded border bg-surface px-3 text-[length:var(--taille-base)] outline-none disabled:bg-surface-attenuee disabled:text-texte-tertiaire";

/**
 * Enveloppe d'un champ : étiquette, contrôle, message d'erreur.
 *
 * L'aide et l'erreur sont reliées au contrôle par `aria-describedby`, et l'erreur signalée par
 * `aria-invalid` — la bordure rouge seule ne suffirait pas. L'astérisque des champs obligatoires est
 * doublée d'un `required` sur le contrôle, seul porteur d'information pour un lecteur d'écran.
 *
 * **Le rattachement se fait ici, et non chez l'appelant.** Les deux paragraphes portaient déjà leur
 * identifiant, mais rien ne les reliait : ils existaient pour qui voit l'écran et disparaissaient
 * pour qui l'écoute, sur les 128 champs de l'application. Le défaut a été découvert en posant les
 * textes d'aide de N5 ; le laisser à la charge de chaque formulaire l'aurait reproduit ailleurs.
 * Un `aria-describedby` déjà posé par l'appelant est **conservé**, le nôtre s'y ajoutant.
 */
export function Champ({
  id,
  label,
  erreur,
  aide,
  obligatoire,
  children,
  className,
}: {
  id: string;
  label: string;
  erreur?: string;
  aide?: string;
  obligatoire?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/*
        L'astérisque est **hors du `<label>`** : à l'intérieur, elle entrerait dans le texte du
        libellé, qui vaudrait « Nom* » — l'étiquette accessible cesserait de correspondre au mot que
        l'utilisateur lit et que les tests interrogent. Elle reste décorative : l'information
        « obligatoire » est portée par `required` sur le contrôle.
      */}
      <div className="flex items-center gap-0.5">
        <label htmlFor={id} className="text-[length:var(--taille-sm)] font-medium">
          {label}
        </label>
        {obligatoire ? (
          <span aria-hidden className="text-danger">
            *
          </span>
        ) : null}
      </div>

      {relier(children, [aide && !erreur ? `${id}-aide` : null, erreur ? `${id}-erreur` : null])}

      {aide && !erreur ? (
        <p id={`${id}-aide`} className="text-[length:var(--taille-xs)] text-texte-tertiaire">
          {aide}
        </p>
      ) : null}

      {erreur ? (
        <p id={`${id}-erreur`} className="text-[length:var(--taille-xs)] text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Rattache au contrôle les paragraphes qui le décrivent.
 *
 * <p>`cloneElement` plutôt qu'une propriété à passer : l'appelant écrit `<Champ><Input …/></Champ>`
 * et n'a pas à connaître les identifiants que `Champ` fabrique. Un enfant qui n'est pas un élément
 * - une chaîne, un fragment - est rendu tel quel : il n'y a alors rien à décrire.
 */
function relier(enfant: ReactNode, identifiants: (string | null)[]): ReactNode {
  const liste = identifiants.filter((valeur): valeur is string => valeur !== null);
  if (liste.length === 0 || !isValidElement(enfant)) {
    return enfant;
  }
  const element = enfant as ReactElement<{ "aria-describedby"?: string }>;
  // Celui que l'appelant a posé lui-même est conservé : le nôtre s'y ajoute.
  const existant = element.props["aria-describedby"];
  return cloneElement(element, {
    "aria-describedby": [existant, ...liste].filter(Boolean).join(" "),
  });
}

export function Input({
  className,
  enErreur,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { enErreur?: boolean }) {
  return (
    <input
      aria-invalid={enErreur || undefined}
      className={cn(BASE, "h-10", enErreur ? "border-danger" : "border-bordure-forte", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  enErreur,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { enErreur?: boolean }) {
  return (
    <select
      aria-invalid={enErreur || undefined}
      className={cn(BASE, "h-10", enErreur ? "border-danger" : "border-bordure-forte", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  enErreur,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { enErreur?: boolean }) {
  return (
    <textarea
      aria-invalid={enErreur || undefined}
      className={cn(
        BASE,
        "min-h-24 py-2 leading-relaxed",
        enErreur ? "border-danger" : "border-bordure-forte",
        className,
      )}
      {...props}
    />
  );
}
