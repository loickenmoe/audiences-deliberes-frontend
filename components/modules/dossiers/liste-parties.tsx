"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/champ";

/**
 * List of parties to the proceedings: claimants or defendants. A case rarely opposes one person to
 * another (e.g. a debtor and their guarantor), so parties are a list, not a single field.
 * The first row cannot be removed: at least one party per side is required, as the server enforces.
 * Entries are `{ nom }` objects rather than strings because `useFieldArray` needs a stable key per
 * row; two homonymous parties would otherwise lose their identity on removal.
 * Each row has its own visually hidden label, so a screen reader does not announce identical
 * fields.
 */
export function ListeParties<T extends FieldValues>({
  nom,
  label,
  placeholder,
  libelleAjout,
  control,
  register,
  errors,
}: Readonly<{
  /** `demandeurs` or `defendeurs`: the array name in the form. */
  nom: "demandeurs" | "defendeurs";
  label: string;
  /** Placeholder for the list fields, telling what to enter. */
  placeholder?: string;
  libelleAjout: string;
  /*
   * Generic over the form shape rather than `Control<any>`: `Control` does not widen to `any`. The
   * component only needs to know the form has an array with this name.
   */
  control: Control<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}>) {
  const t = useTranslations("dossiers");
  const { fields, append, remove } = useFieldArray({ control, name: nom as ArrayPath<T> });
  const erreurs = errors[nom] as { nom?: { message?: string } }[] | undefined;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[length:var(--taille-sm)] font-medium">
        {label} <span aria-hidden className="text-danger">*</span>
      </legend>


      {fields.map((champ, index) => {
        const identifiant = `${nom}-${index}`;
        const erreur = erreurs?.[index]?.nom?.message;
        return (
          <div key={champ.id} className="flex flex-col gap-1">
            <div className="flex items-start gap-2">
              <label htmlFor={identifiant} className="sr-only">
                {t("partieRang", { partie: label, rang: index + 1 })}
              </label>
              <Input
                id={identifiant}
                className="flex-1"
                placeholder={placeholder}
                enErreur={!!erreur}
                aria-describedby={erreur ? `${identifiant}-erreur` : undefined}
                {...register(`${nom}.${index}.nom` as Path<T>)}
              />
              <Button
                type="button"
                variante="secondaire"
                taille="sm"
                disabled={fields.length === 1}
                aria-label={t("retirerPartie", { partie: label, rang: index + 1 })}
                onClick={() => remove(index)}
              >
                <X size={14} aria-hidden />
              </Button>
            </div>
            {erreur ? (
              <p id={`${identifiant}-erreur`} className="text-[length:var(--taille-xs)] text-danger">
                {erreur}
              </p>
            ) : null}
          </div>
        );
      })}

      <div>
        <Button type="button" variante="secondaire" taille="sm" onClick={() => append({ nom: "" } as never)}>
          <Plus size={14} aria-hidden />
          {libelleAjout}
        </Button>
      </div>
    </fieldset>
  );
}
