"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Televersement } from "@/components/metier/televersement";
import { Button } from "@/components/ui/button";
import { piecesDeCategorie, type TypeDocument } from "@/lib/documents";
import type { CategorieDossier } from "@/types/enums";

export interface PieceAJoindre {
  type: TypeDocument;
  fichier: File;
}

/**
 * Documents attached when creating a case; they are **required**.
 * One area per document required by the category (credit file and transfer report for debt
 * recovery, account incident and supporting evidence for a dispute). Each file is checked locally
 * (format, 10 MB) and **viewable before upload**. Other documents are added later from the case's
 * Documents tab.
 * Files are only uploaded after the case is created, since the DMS upload needs its id; the form
 * orchestrates this two-step upload.
 * When `reference` is provided, each expected document combines its file and its optional reference
 * on one row; this component only places that field, the form still saves and sends it.
 * `manquantes` lists the documents saved without a file. The error is shown on the document itself,
 * never in a banner above: on a twenty-field form a global message leaves the user searching.
 */
export function PiecesAJoindre({
  categorie,
  onChangement,
  reference,
  manquantes,
}: Readonly<{
  categorie: CategorieDossier;
  onChangement: (pieces: PieceAJoindre[]) => void;
  /** Reference field of an expected document, placed at the start of its row. */
  reference?: (type: TypeDocument) => ReactNode;
  /** Expected documents still missing a file, flagged after a save attempt. */
  manquantes?: readonly TypeDocument[];
}>) {
  const t = useTranslations("documents");
  const [attendues, setAttendues] = useState<Partial<Record<TypeDocument, File>>>({});
  const [apercu, setApercu] = useState<File | null>(null);

  const types = piecesDeCategorie(categorie);

  // Changing the category changes the expected documents: the other category's no longer apply.
  useEffect(() => {
    setAttendues({});
  }, [categorie]);

  useEffect(() => {
    const pieces: PieceAJoindre[] = types.flatMap((type) =>
      attendues[type] ? [{ type, fichier: attendues[type]! }] : [],
    );
    onChangement(pieces);
    // `types` derives from `categorie`, already in the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendues, categorie]);

  function BoutonApercu({ fichier }: Readonly<{ fichier: File | undefined | null }>) {
    if (!fichier) return null;
    return (
      // The accessible name includes the file: both required documents have a "Preview" button, and
      // two actions with the same name in one form cannot be told apart by ear.
      <Button
        variante="secondaire"
        taille="sm"
        aria-label={`${t("apercu")} - ${fichier.name}`}
        onClick={() => setApercu(fichier)}
      >
        <Eye size={14} aria-hidden />
        {t("apercu")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
        {reference ? t("fichiersAide") : t("piecesAide")}
      </p>

      {types.map((type) => (
        <div key={`${categorie}-${type}`} className="flex flex-col gap-1.5">
          {reference ? (
            <>
              {reference(type)}
              {/*
                Same pattern as `Champ`: the asterisk is outside the label, decorative and
                aria-hidden. The "required" information is carried by the file input's accessible
                name (`fichierDe`); a hidden file input cannot use `required` without triggering
                browser validation.
              */}
              <span className="flex items-center gap-0.5 text-[length:var(--taille-xs)] text-texte-tertiaire">
                {t("fichierLibelle")}
                <span aria-hidden className="text-danger">
                  *
                </span>
              </span>
            </>
          ) : (
            <span className="text-[length:var(--taille-sm)] font-medium">{t(`types.${type}` as never)}</span>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <Televersement
              nom={`piece-${type}`}
              // A name specific to each area, distinct from the exact label of the neighbouring
              // reference.
              label={reference ? t("fichierDe", { piece: t(`types.${type}` as never) }) : undefined}
              onChangement={(fichier) =>
                setAttendues((precedentes) => ({ ...precedentes, [type]: fichier ?? undefined }))
              }
            />
            <BoutonApercu fichier={attendues[type]} />
          </div>
          {manquantes?.includes(type) ? (
            <p role="alert" className="text-[length:var(--taille-xs)] text-danger">
              {t("fichierManquant")}
            </p>
          ) : null}
        </div>
      ))}

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.name ?? ""}
        obtenir={() => (apercu ? Promise.resolve(apercu) : Promise.reject(new Error("aucun fichier")))}
      />
    </div>
  );
}
