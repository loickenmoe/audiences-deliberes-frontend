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
 * Field wrapper: label, control, error message.
 *
 * Help and error text are linked to the control via `aria-describedby`, and the error is flagged with
 * `aria-invalid` (a red border alone is not enough). The required asterisk is doubled by `required` on
 * the control, the only information a screen reader gets.
 *
 * The linking is done here rather than by each caller so no form can forget it. An
 * `aria-describedby` already set by the caller is **kept**, ours is appended.
 */
export function Champ({
  id,
  label,
  erreur,
  aide,
  obligatoire,
  children,
  className,
}: Readonly<{
  id: string;
  label: string;
  erreur?: string;
  aide?: string;
  obligatoire?: boolean;
  children: ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/*
        The asterisk is **outside the `<label>`**: inside, it would become part of the label text
        ("Name*") and the accessible label would no longer match the word users read and tests
        query. It stays decorative: "required" is carried by `required` on the control.
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
 * Links the describing paragraphs to the control.
 *
 * `cloneElement` rather than a prop: callers write `<Champ><Input …/></Champ>` without knowing the
 * ids `Champ` generates. A child that is not an element (string, fragment) is rendered as is.
 */
function relier(enfant: ReactNode, identifiants: (string | null)[]): ReactNode {
  const liste = identifiants.filter((valeur): valeur is string => valeur !== null);
  if (liste.length === 0 || !isValidElement(enfant)) {
    return enfant;
  }
  const element = enfant as ReactElement<{ "aria-describedby"?: string }>;
  // An id set by the caller is kept; ours is appended.
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
