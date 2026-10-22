"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { EtatChargement } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { natureApercu, telechargerBlob, type NatureApercu } from "@/lib/documents";
import { cn } from "@/lib/utils";

type Etat =
  | { phase: "chargement" }
  | { phase: "erreur" }
  | { phase: "pret"; contenu: Blob; url: string; texte: string | null };

/**
 * In-app file preview, both for a local file before upload and for a document already in the DMS
 * (fetched through its pre-signed URL); `obtenir` hides the difference.
 * Content is shown from a local `blob:` URL rather than the MinIO URL, so it stays readable after
 * the pre-signed URL expires (10 minutes) and a download keeps the original file name.
 */
export function ApercuFichier({
  ouvert,
  onFermeture,
  nomFichier,
  obtenir,
}: Readonly<{
  ouvert: boolean;
  onFermeture: () => void;
  nomFichier: string;
  obtenir: () => Promise<Blob>;
}>) {
  const t = useTranslations("documents");
  const tc = useTranslations("commun");
  const [etat, setEtat] = useState<Etat>({ phase: "chargement" });
  const nature = natureApercu(nomFichier);
  const conteneurWord = useRef<HTMLDivElement>(null);
  const [renduWord, setRenduWord] = useState<"attente" | "fait" | "erreur">("attente");

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

    // A `blob:` URL keeps the content in memory until it is revoked.
    return () => {
      annule = true;
      if (url) URL.revokeObjectURL(url);
    };
    // `obtenir` changes on every parent render: only opening triggers a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, nomFichier]);

  /**
   * Renders a `.docx` inline. The library is loaded on demand: it weighs a few hundred KB and is
   * only used here. It writes directly to the DOM, so it gets a dedicated container that is emptied
   * before each render to avoid stacking two documents.
   */
  useEffect(() => {
    if (!ouvert || etat.phase !== "pret" || nature !== "word") return;
    const cible = conteneurWord.current;
    if (!cible) return;

    let annule = false;
    setRenduWord("attente");
    cible.replaceChildren();

    import("docx-preview")
      .then(({ renderAsync }) =>
        renderAsync(etat.contenu, cible, undefined, {
          className: "docx",
          inWrapper: true,
          // The original page width is kept (it drives the layout of a brief); the height is not:
          // the document scrolls inside the window.
          ignoreWidth: false,
          ignoreHeight: true,
          breakPages: true,
        }),
      )
      .then(() => {
        if (!annule) setRenduWord("fait");
      })
      .catch(() => {
        if (!annule) setRenduWord("erreur");
      });

    return () => {
      annule = true;
    };
  }, [ouvert, nature, etat]);

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

      {etat.phase === "pret" && nature !== "word" ? (
        <ApercuSimple nature={nature} url={etat.url} texte={etat.texte} nomFichier={nomFichier} />
      ) : null}

      {etat.phase === "pret" && nature === "word" ? (
        <>
          {renduWord === "attente" ? <EtatChargement lignes={4} /> : null}
          {renduWord === "erreur" ? (
            <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
              {t("apercuWordErreur")}
            </p>
          ) : null}
          {/*
            White background rather than `surface`: the Word page carries its own colors, and a
            tinted background would look like document formatting.
          */}
          <div
            ref={conteneurWord}
            className={cn(
              "max-h-[70vh] overflow-auto rounded border border-bordure bg-white",
              renduWord === "fait" ? "" : "hidden",
            )}
          />
        </>
      ) : null}
    </Dialog>
  );
}

/** Every format except `.docx`, which needs its own rendering container. */
function ApercuSimple({
  nature,
  url,
  texte,
  nomFichier,
}: Readonly<{ nature: Exclude<NatureApercu, "word">; url: string; texte: string | null; nomFichier: string }>) {
  const t = useTranslations("documents");
  switch (nature) {
    case "pdf":
      return <iframe title={nomFichier} src={url} className="h-[70vh] w-full rounded border border-bordure" />;
    case "image":
      return (
        // A `blob:` URL does not go through the Next image optimizer, so `<img>` is the only
        // option.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={nomFichier} className="mx-auto max-h-[70vh] rounded" />
      );
    case "texte":
      return (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded border border-bordure bg-surface-attenuee p-4 text-[length:var(--taille-sm)]">
          {texte}
        </pre>
      );
    case "word-ancien":
      return <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("apercuWordAncien")}</p>;
    default:
      return <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("apercuImpossible")}</p>;
  }
}
