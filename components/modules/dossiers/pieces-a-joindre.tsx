"use client";

import { Eye, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
 * incident de compte et justificatifs pour un litige), plus des « autres pièces » en nombre libre.
 * Chaque fichier est contrôlé localement (format, 10 Mo) et **lisible avant l'envoi**.
 *
 * Les fichiers ne partent qu'après la création du dossier : le dépôt en GED exige son
 * identifiant. C'est le formulaire qui orchestre cet envoi en deux temps.
 */
export function PiecesAJoindre({
  categorie,
  onChangement,
}: {
  categorie: CategorieDossier;
  onChangement: (pieces: PieceAJoindre[]) => void;
}) {
  const t = useTranslations("documents");
  const [attendues, setAttendues] = useState<Partial<Record<TypeDocument, File>>>({});
  const [autres, setAutres] = useState<{ cle: number; fichier: File | null }[]>([]);
  const [prochaineCle, setProchaineCle] = useState(1);
  const [apercu, setApercu] = useState<File | null>(null);

  const types = piecesDeCategorie(categorie);

  // Changer de catégorie change les pièces attendues : celles de l'autre n'ont plus de sens.
  useEffect(() => {
    setAttendues({});
  }, [categorie]);

  useEffect(() => {
    const pieces: PieceAJoindre[] = [
      ...types.flatMap((type) => (attendues[type] ? [{ type, fichier: attendues[type]! }] : [])),
      ...autres.flatMap(({ fichier }) => (fichier ? [{ type: "AUTRE" as const, fichier }] : [])),
    ];
    onChangement(pieces);
    // `types` dérive de `categorie`, déjà présente dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendues, autres, categorie]);

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
      <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("piecesAide")}</p>

      {types.map((type) => (
        <div key={`${categorie}-${type}`} className="flex flex-col gap-1.5">
          <span className="text-[length:var(--taille-sm)] font-medium">{t(`types.${type}` as never)}</span>
          <div className="flex flex-wrap items-start gap-3">
            <Televersement
              nom={`piece-${type}`}
              onChangement={(fichier) =>
                setAttendues((precedentes) => ({ ...precedentes, [type]: fichier ?? undefined }))
              }
            />
            <BoutonApercu fichier={attendues[type]} />
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-3">
        <span className="text-[length:var(--taille-sm)] font-medium">{t("autresPieces")}</span>
        {autres.map(({ cle, fichier }) => (
          <div key={cle} className="flex flex-wrap items-start gap-3">
            <Televersement
              nom={`piece-autre-${cle}`}
              onChangement={(choisi) =>
                setAutres((liste) => liste.map((ligne) => (ligne.cle === cle ? { cle, fichier: choisi } : ligne)))
              }
            />
            <BoutonApercu fichier={fichier} />
            <button
              type="button"
              onClick={() => setAutres((liste) => liste.filter((ligne) => ligne.cle !== cle))}
              aria-label={t("retirerPiece")}
              className="rounded p-1.5 text-texte-tertiaire transition-colors hover:bg-surface-attenuee hover:text-texte"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
        <div>
          <Button
            variante="secondaire"
            taille="sm"
            onClick={() => {
              setAutres((liste) => [...liste, { cle: prochaineCle, fichier: null }]);
              setProchaineCle((cle) => cle + 1);
            }}
          >
            <Plus size={14} aria-hidden />
            {t("ajouterAutre")}
          </Button>
        </div>
      </div>

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.name ?? ""}
        obtenir={() => (apercu ? Promise.resolve(apercu) : Promise.reject(new Error("aucun fichier")))}
      />
    </div>
  );
}
