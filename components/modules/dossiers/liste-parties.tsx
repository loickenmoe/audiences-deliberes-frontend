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
 * Une liste de parties au procès — demandeurs ou défendeurs.
 *
 * **Pourquoi une liste et non un champ** (métier, 2026-10-03, observations 1 et 3). Un procès
 * oppose rarement une personne à une autre : la banque assigne un débiteur *et* sa caution, se
 * défend contre plusieurs héritiers. Les champs uniques d'origine obligeaient à tout écrire dans
 * une phrase, et ce qui tient dans une phrase ne se compte pas et ne se retrouve pas.
 *
 * **La première ligne ne se retire pas.** Au moins une partie de chaque côté est exigée : laisser
 * supprimer la dernière produirait un formulaire que le serveur refusera, et l'utilisateur
 * découvrirait l'obligation après l'envoi plutôt qu'en la lisant.
 *
 * Les entrées sont des objets `{ nom }` et non des chaînes : `useFieldArray` identifie ses lignes
 * par une clé stable, qu'une liste de chaînes ne peut pas porter — deux parties homonymes
 * perdraient leur identité au premier retrait.
 *
 * Chaque ligne porte un libellé propre, masqué visuellement : sans lui, un lecteur d'écran annonce
 * trois champs identiques. C'est la règle déjà appliquée aux téléversements et aux aperçus.
 */
export function ListeParties<T extends FieldValues>({
  nom,
  label,
  libelleAjout,
  control,
  register,
  errors,
}: {
  /** `demandeurs` ou `defendeurs` : le nom du tableau dans le formulaire. */
  nom: "demandeurs" | "defendeurs";
  label: string;
  libelleAjout: string;
  /*
   * Générique sur la forme du formulaire plutôt que `Control<any>` : `Control` ne s'élargit pas à
   * `any`, et le typage l'a refusé à la compilation. Le composant n'a besoin de savoir qu'une
   * chose : le formulaire porte un tableau de ce nom.
   */
  control: Control<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}) {
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
