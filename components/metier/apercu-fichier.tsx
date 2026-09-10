"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { EtatChargement } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { natureApercu, telechargerBlob } from "@/lib/documents";

type Etat =
  | { phase: "chargement" }
  | { phase: "erreur" }
  | { phase: "pret"; contenu: Blob; url: string; texte: string | null };

/**
 * Aperçu d'un fichier, **dans l'application**.
 *
 * Sert deux moments : lire une pièce **avant** de la déposer (le fichier est encore local) et lire
 * une pièce déjà en GED (le contenu est alors récupéré par son URL pré-signée). `obtenir` masque la
 * différence.
 *
 * Le contenu est affiché depuis une URL `blob:` locale et non depuis l'URL MinIO : il reste lisible
 * même après l'expiration de l'URL pré-signée (10 minutes), et le téléchargement conserve le nom
 * d'origine du fichier.
 */
export function ApercuFichier({
  ouvert,
  onFermeture,
  nomFichier,
  obtenir,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  nomFichier: string;
  obtenir: () => Promise<Blob>;
}) {
  const t = useTranslations("documents");
  const tc = useTranslations("commun");
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const nature = natureApercu(nomFichier);

  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    let url: string | null = null;
    setEtat({ phase: "chargement" });

    obtenir()
      .then(async (contenu) => {
        const texte = nature === "texte" ? await contenu.text() : null;
        if (annule) return;
        url = URL.createObjectURL(contenu);
        setEtat({ phase: "pret", contenu, url, texte });
      })
      .catch(() => {
        if (!annule) setEtat({ phase: "erreur" });
      });

    // L'URL `blob:` retient le contenu en mémoire tant qu'elle n'est pas libérée.
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
    // `obtenir` change à chaque rendu du parent : seule l'ouverture relance le chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, nomFichier]);

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("apercuTitre", { nom: nomFichier })}
      className="w-[min(56rem,calc(100vw-2rem))]"
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture}>
            {tc("fermer")}
          </Button>
          <Button
            disabled={etat.phase !== "pret"}
            onClick={() => etat.phase === "pret" && telechargerBlob(etat.contenu, nomFichier)}
          >
            <Download size={14} aria-hidden />
            {t("telecharger")}
          </Button>
        </>
      }
    >
      {etat.phase === "chargement" ? <EtatChargement lignes={4} /> : null}

      {etat.phase === "erreur" ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {t("apercuErreur")}
        </p>
      ) : null}

      {etat.phase === "pret" && nature === "pdf" ? (
        <iframe title={nomFichier} src={etat.url} className="h-[70vh] w-full rounded border border-bordure" />
      ) : null}

      {etat.phase === "pret" && nature === "image" ? (
        // Une URL `blob:` ne passe pas par l'optimiseur d'images de Next : `<img>` est le seul choix.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={etat.url} alt={nomFichier} className="mx-auto max-h-[70vh] rounded" />
      ) : null}

      {etat.phase === "pret" && nature === "texte" ? (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded border border-bordure bg-surface-attenuee p-4 text-[length:var(--taille-sm)]">
          {etat.texte}
        </pre>
      ) : null}

      {etat.phase === "pret" && nature === null ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("apercuImpossible")}</p>
      ) : null}
    </Dialog>
  );
}
