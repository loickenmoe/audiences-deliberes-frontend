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
 * Pièces jointes à la création d'un dossier — facultatives.
 *
 * Une zone par pièce qu'appelle la catégorie (dossier de crédit et PV pour un recouvrement,
 * incident de compte et justificatifs pour un litige). Chaque fichier est contrôlé localement
 * (format, 10 Mo) et **lisible avant l'envoi**.
 *
 * Pas d'« autres pièces » à la création (2026-09-22, porteur du projet) : elles s'ajoutent depuis
 * l'onglet Documents de la fiche, une fois le dossier créé. Le formulaire se limite ainsi à ce que la
 * catégorie appelle.
 *
 * Les fichiers ne partent qu'après la création du dossier : le dépôt en GED exige son
 * identifiant. C'est le formulaire qui orchestre cet envoi en deux temps.
 *
 * **Une ligne par pièce** (2026-09-22). Quand `reference` est fourni, chaque pièce attendue réunit
 * sa référence — champ du formulaire, obligatoire — et son fichier, facultatif. La pièce n'est plus
 * nommée qu'une fois, par le libellé de sa référence, au lieu de l'être dans deux blocs distincts. Ce
 * composant ne fait que placer ce champ : il reste enregistré, validé et envoyé par le formulaire.
 */
export function PiecesAJoindre({
  categorie,
  onChangement,
  reference,
}: {
  categorie: CategorieDossier;
  onChangement: (pieces: PieceAJoindre[]) => void;
  /** Le champ de référence d'une pièce attendue, placé en tête de sa ligne. */
  reference?: (type: TypeDocument) => ReactNode;
}) {
  const t = useTranslations("documents");
  const [attendues, setAttendues] = useState<Partial<Record<TypeDocument, File>>>({});
  const [apercu, setApercu] = useState<File | null>(null);

  const types = piecesDeCategorie(categorie);

  // Changer de catégorie change les pièces attendues : celles de l'autre n'ont plus de sens.
  useEffect(() => {
    setAttendues({});
  }, [categorie]);

  useEffect(() => {
    const pieces: PieceAJoindre[] = types.flatMap((type) =>
      attendues[type] ? [{ type, fichier: attendues[type]! }] : [],
    );
    onChangement(pieces);
    // `types` dérive de `categorie`, déjà présente dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendues, categorie]);

  function BoutonApercu({ fichier }: { fichier: File | undefined | null }) {
    if (!fichier) return null;
    return (
      <Button variante="secondaire" taille="sm" onClick={() => setApercu(fichier)}>
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
              <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("fichierFacultatif")}</span>
            </>
          ) : (
            <span className="text-[length:var(--taille-sm)] font-medium">{t(`types.${type}` as never)}</span>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <Televersement
              nom={`piece-${type}`}
              // Un nom propre à chaque zone, distinct du libellé exact de la référence voisine.
              label={reference ? t("fichierDe", { piece: t(`types.${type}` as never) }) : undefined}
              onChangement={(fichier) =>
                setAttendues((precedentes) => ({ ...precedentes, [type]: fichier ?? undefined }))
              }
            />
            <BoutonApercu fichier={attendues[type]} />
          </div>
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
