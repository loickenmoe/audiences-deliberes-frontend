import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const BASE =
  "w-full rounded border bg-surface px-3 text-[length:var(--taille-base)] outline-none disabled:bg-surface-attenuee disabled:text-texte-tertiaire";

/**
 * Enveloppe d'un champ : étiquette, contrôle, message d'erreur.
 *
 * L'erreur est reliée au contrôle par `aria-describedby` et signalée par `aria-invalid` — la
 * bordure rouge seule ne suffirait pas. L'astérisque des champs obligatoires est doublée d'un
 * `required` sur le contrôle, seul porteur d'information pour un lecteur d'écran.
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
      <label htmlFor={id} className="text-[length:var(--taille-sm)] font-medium">
        {label}
        {obligatoire ? (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        ) : null}
      </label>

      {children}

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
