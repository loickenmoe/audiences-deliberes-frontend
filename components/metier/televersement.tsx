"use client";

import { Paperclip, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { PoidsFichier } from "@/components/metier/valeurs";
import { Button } from "@/components/ui/button";
import type { Langue } from "@/i18n/config";
import { formaterOctets } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Sélection d'un fichier, avec contrôle du format et du poids **avant** l'envoi.
 *
 * Le backend contrôle déjà les deux et refuse par `ERR-008` — ce contrôle local ne le remplace pas,
 * il évite à l'utilisateur d'attendre le téléversement d'un fichier de 40 Mo pour apprendre qu'il
 * est trop lourd.
 *
 * **Le format est dérivé de l'extension, pas du type MIME déclaré** — c'est la règle du backend
 * (Q-46) : s'en écarter ferait accepter localement un fichier que le serveur refusera.
 */
export function Televersement({
  nom,
  formatsAcceptes,
  tailleMax,
  onChangement,
  className,
}: {
  nom: string;
  /** Extensions admises, sans point. Défaut : les formats de la GED (RG-GED-08). */
  formatsAcceptes?: readonly string[];
  /** Plafond en octets. Défaut : 10 Mo, valeur de `TAILLE_MAX_GED`. */
  tailleMax?: number;
  onChangement?: (fichier: File | null) => void;
  className?: string;
}) {
  const formats = formatsAcceptes ?? ["pdf", "png", "jpg", "txt", "xlsx"];
  const plafond = tailleMax ?? 10 * 1024 * 1024;

  const t = useTranslations("metier");
  const langue = useLocale() as Langue;
  const champ = useRef<HTMLInputElement>(null);
  const id = useId();

  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const listeFormats = formats.map((f) => f.toUpperCase()).join(", ");

  function extension(nomFichier: string): string {
    const point = nomFichier.lastIndexOf(".");
    return point === -1 ? "" : nomFichier.slice(point + 1).toLowerCase();
  }

  function selectionner(choisi: File | null) {
    if (!choisi) {
      setFichier(null);
      setErreur(null);
      onChangement?.(null);
      return;
    }

    if (!formats.includes(extension(choisi.name))) {
      setErreur(t("formatNonAccepte", { formats: listeFormats }));
      setFichier(null);
      onChangement?.(null);
      return;
    }

    if (choisi.size > plafond) {
      setErreur(t("fichierTropVolumineux", { taille: formaterOctets(plafond, langue) }));
      setFichier(null);
      onChangement?.(null);
      return;
    }

    setErreur(null);
    setFichier(choisi);
    onChangement?.(choisi);
  }

  function retirer() {
    if (champ.current) champ.current.value = "";
    selectionner(null);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={champ}
        id={id}
        name={nom}
        type="file"
        accept={formats.map((f) => `.${f}`).join(",")}
        onChange={(evenement) => selectionner(evenement.target.files?.[0] ?? null)}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-erreur` : `${id}-contraintes`}
        className="sr-only"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variante="secondaire" onClick={() => champ.current?.click()}>
          <Paperclip size={14} aria-hidden />
          {t("choisirFichier")}
        </Button>

        {fichier ? (
          <span className="flex items-center gap-2 text-[length:var(--taille-sm)]">
            <span className="max-w-[18rem] truncate">{fichier.name}</span>
            <span className="text-texte-tertiaire">
              <PoidsFichier valeur={fichier.size} />
            </span>
            <button
              type="button"
              onClick={retirer}
              aria-label={t("retirerFichier")}
              className="rounded p-0.5 text-texte-tertiaire transition-colors hover:bg-surface-attenuee hover:text-texte"
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        ) : (
          <span className="text-[length:var(--taille-sm)] text-texte-tertiaire">
            {t("aucunFichier")}
          </span>
        )}
      </div>

      {erreur ? (
        <p id={`${id}-erreur`} role="alert" className="text-[length:var(--taille-xs)] text-danger">
          {erreur}
        </p>
      ) : (
        <p id={`${id}-contraintes`} className="text-[length:var(--taille-xs)] text-texte-tertiaire">
          {t("formatsAcceptes", { formats: listeFormats })} ·{" "}
          {t("tailleMax", { taille: formaterOctets(plafond, langue) })}
        </p>
      )}
    </div>
  );
}
