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
 * File selection with format and size checks **before** upload.
 * The backend also checks both and rejects with `ERR-008`; this local check only spares the user a
 * long upload. The format is derived from the extension, not the declared MIME type, to match the
 * backend rule.
 */
export function Televersement({
  nom,
  label,
  formatsAcceptes,
  tailleMax,
  surUneLigne = false,
  onChangement,
  className,
}: {
  nom: string;
  /**
   * Accessible name of the file input, which is visually hidden (`sr-only`) and triggered by a
   * button;
   * without it a screen reader only announces "file input".
   */
  label?: string;
  /** Allowed extensions, without the dot. Default: the DMS formats (RG-GED-08). */
  formatsAcceptes?: readonly string[];
  /** Size limit in bytes. Default: 10 MB, the value of `TAILLE_MAX_GED`. */
  tailleMax?: number;
  /**
   * Keeps the button, file name and size on a single line, truncating the name instead of wrapping,
   * so a neighbouring button (e.g. preview) is not pushed to the next line. Optional, so other
   * screens keep their layout.
   */
  surUneLigne?: boolean;
  onChangement?: (fichier: File | null) => void;
  className?: string;
}) {
  // The default formats mirror `FORMATS_GED` (RG-GED-08): any change to that setting must be
  // reflected here, otherwise the screen would reject a file the server accepts.
  const formats = formatsAcceptes ?? ["pdf", "png", "jpg", "txt", "xlsx", "docx", "doc"];
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
        aria-label={label ?? t("choisirFichier")}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-erreur` : `${id}-contraintes`}
        className="sr-only"
      />

      <div className={cn("flex items-center gap-3", surUneLigne ? "flex-nowrap" : "flex-wrap")}>
        <Button variante="secondaire" className="shrink-0" onClick={() => champ.current?.click()}>
          <Paperclip size={14} aria-hidden />
          {t("choisirFichier")}
        </Button>

        {fichier ? (
          <span
            className={cn(
              "flex items-center gap-2 text-[length:var(--taille-sm)]",
              surUneLigne && "min-w-0",
            )}
          >
            {/*
              `title` holds the full name so it stays readable on hover when truncated; neighbouring
              actions also carry it in their accessible name.
            */}
            <span
              className={cn("truncate", surUneLigne ? "min-w-0" : "max-w-[18rem]")}
              title={fichier.name}
            >
              {fichier.name}
            </span>
            <span className="shrink-0 text-texte-tertiaire">
              <PoidsFichier valeur={fichier.size} />
            </span>
            <button
              type="button"
              onClick={retirer}
              aria-label={t("retirerFichier")}
              className="shrink-0 rounded p-0.5 text-texte-tertiaire transition-colors hover:bg-surface-attenuee hover:text-texte"
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
