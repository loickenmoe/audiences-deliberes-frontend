"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { EmpreinteAffichee } from "@/components/modules/audit/empreinte-affichee";
import { Button } from "@/components/ui/button";
import { empreinteFichier } from "@/lib/empreinte";
import { auditService } from "@/services/auditService";
import type { VerificationArchive } from "@/types/domaine";

/**
 * Vérifie qu'un fichier détenu correspond à une archive produite ici (backend Q-114).
 *
 * **C'est ce qui rend l'empreinte utile.** Sans ce chemin, vérifier supposait d'ouvrir un terminal,
 * de taper `sha256sum` et de comparer soixante-quatre caractères à l'œil — autant dire que personne
 * ne le faisait. Une empreinte que nul ne vérifie n'est qu'une décoration.
 *
 * **Le fichier ne quitte jamais le poste.** L'empreinte est calculée par le navigateur ; seul son
 * résultat part au serveur. Un document d'audit n'a aucune raison de traverser le réseau pour être
 * comparé à lui-même — et transmettre une pièce pour la vérifier serait une singulière façon de la
 * protéger.
 *
 * **Ce que la réponse signifie, et ne signifie pas.** « Reconnue » prouve que le fichier n'a pas
 * changé depuis qu'on l'a scellé. Elle ne prouve pas l'antériorité face à un tiers : l'application
 * détient à la fois le fichier et la ligne qui l'atteste. L'écran le dit plutôt que de le taire.
 */
export function VerificateurEmpreinte() {
  const t = useTranslations("audit");
  const champ = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [nomFichier, setNomFichier] = useState("");
  const [empreinte, setEmpreinte] = useState("");
  const [resultat, setResultat] = useState<VerificationArchive | null>(null);
  const [erreur, setErreur] = useState("");

  async function verifier(fichier: File) {
    setEnCours(true);
    setResultat(null);
    setErreur("");
    setNomFichier(fichier.name);
    try {
      const calculee = await empreinteFichier(fichier);
      setEmpreinte(calculee);
      setResultat(await auditService.verifier(calculee));
    } catch (cause) {
      setEmpreinte("");
      setErreur(
        cause instanceof Error && cause.message === "CONTEXTE_NON_SECURISE"
          ? t("verifierContexte")
          : t("verifierEchec"),
      );
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section
      aria-label={t("verifierTitre")}
      className="flex flex-col gap-3 rounded border border-bordure bg-surface p-5"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--taille-lg)] font-semibold tracking-tight">{t("verifierTitre")}</h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("verifierDescription")}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={champ}
          id="verifier-fichier"
          type="file"
          className="sr-only"
          onChange={(evenement) => {
            const fichier = evenement.target.files?.[0];
            if (fichier) void verifier(fichier);
            // Réinitialisé pour que redéposer le même fichier relance bien une vérification.
            evenement.target.value = "";
          }}
        />
        <Button variante="secondaire" onClick={() => champ.current?.click()} disabled={enCours}>
          {enCours ? t("verifierEnCours") : t("verifierChoisir")}
        </Button>
        {nomFichier ? (
          <span className="text-[length:var(--taille-sm)] text-texte-secondaire">{nomFichier}</span>
        ) : null}
      </div>

      {erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {erreur}
        </p>
      ) : null}

      {resultat ? (
        <div
          role="status"
          className={`flex flex-col gap-2 rounded border p-3 ${
            resultat.reconnue ? "border-succes bg-succes-fond" : "border-danger bg-danger-fond"
          }`}
        >
          <p className="text-[length:var(--taille-sm)] font-medium">
            {resultat.reconnue && resultat.archive
              ? t("verifierReconnue", {
                  reference: resultat.archive.reference,
                  debut: resultat.archive.dateDebut,
                  fin: resultat.archive.dateFin,
                  lignes: resultat.archive.lignes,
                })
              : t("verifierInconnue")}
          </p>
          {/*
            L'empreinte calculée est montrée dans les deux cas. Reconnue, elle confirme ce qui a été
            comparé ; inconnue, elle permet de la transmettre pour comprendre — c'est précisément le
            moment où l'on en a besoin.
          */}
          {empreinte ? <EmpreinteAffichee empreinte={empreinte} /> : null}
          <p className="text-[length:var(--taille-xs)] text-texte-secondaire">
            {resultat.reconnue ? t("verifierPortee") : t("verifierInconnueAide")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
