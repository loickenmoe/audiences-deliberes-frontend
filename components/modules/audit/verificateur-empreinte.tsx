"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { EmpreinteAffichee } from "@/components/modules/audit/empreinte-affichee";
import { Button } from "@/components/ui/button";
import { empreinteFichier } from "@/lib/empreinte";
import { auditService } from "@/services/auditService";
import type { VerificationArchive } from "@/types/domaine";

/**
 * Checks that a held file matches an archive produced here.
 * The file never leaves the workstation: the fingerprint is computed in the browser and only the
 * result is sent to the server.
 * "Recognized" proves the file has not changed since it was sealed; it does not prove precedence to
 * a third party, since the application holds both the file and the record attesting it.
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
    } catch (error_) {
      setEmpreinte("");
      setErreur(
        error_ instanceof Error && error_.message === "CONTEXTE_NON_SECURISE"
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
            // Reset so that dropping the same file again triggers a new check.
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
        <div // NOSONAR - <output> only accepts phrasing content; the result holds paragraphs
          role="status" // NOSONAR - same reason
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
            The computed fingerprint is shown in both cases: if recognized it confirms what was
            compared, if unknown it can be passed on for investigation.
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
