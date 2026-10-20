"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { DateHeureValeur, PoidsFichier } from "@/components/metier";
import { EmpreinteAffichee } from "@/components/modules/audit/empreinte-affichee";
import { Button } from "@/components/ui/button";
import { useArchivesAudit, useExporterAudit } from "@/hooks/useAudit";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import { RACCOURCIS_PERIODE, periodeDe, type RaccourciPeriode } from "@/lib/periodes";
import type { FiltresAudit } from "@/services/auditService";
import { auditService } from "@/services/auditService";

/**
 * Audit export and previously produced archives.
 * Each export is sealed: stored on the server with its SHA-256 fingerprint recorded, so the file
 * can later be proven to be the one that was sealed.
 * Both formats are produced: the PDF as a fixed document, the Excel file for sorting and
 * cross-checking.
 * Shortcuts prefill the period without replacing the free period; each covers the elapsed calendar
 * unit and stops today, as an archive must not claim to cover future days.
 */
export function ExportAudit({
  filtres,
  debut,
  fin,
  onPeriode,
}: Readonly<{
  filtres: FiltresAudit;
  debut: string;
  fin: string;
  /** A shortcut fills the screen's period fields: it does not start an export. */
  onPeriode: (periode: { debut: string; fin: string }) => void;
}>) {
  const t = useTranslations("audit");
  const { nomUtilisateur } = useLibelles();
  const exporter = useExporterAudit();
  const archives = useArchivesAudit();

  const periodeManquante = !debut || !fin;

  /**
   * The download uses a temporary link rather than a navigation: the call carries the auth token,
   * which `window.open` would not send.
   */
  function remettre(fichier: Blob, nomFichier: string) {
    const url = URL.createObjectURL(fichier);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
    URL.revokeObjectURL(url);
  }

  function lancer(format: "PDF" | "EXCEL") {
    exporter.mutate(
      { filtres: { ...filtres, dateDebut: debut, dateFin: fin }, format },
      {
        onSuccess: ({ fichier, nomFichier, empreinte }) => {
          remettre(fichier, nomFichier);
          // The fingerprint is announced: it travels with the file and can be checked against the
          // list.
          toast.success(t("exportReussi", { empreinte: empreinte.slice(0, 12) }));
        },
        onError: (erreur) => toast.error(messageErreur(erreur)),
      },
    );
  }

  async function recuperer(id: number) {
    try {
      const url = await auditService.urlArchive(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error_) {
      toast.error(messageErreur(error_));
    }
  }

  const lignes = archives.data?.content ?? [];

  return (
    <section
      aria-label={t("exportTitre")}
      className="flex flex-col gap-4 rounded border border-bordure bg-surface p-5"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--taille-lg)] font-semibold tracking-tight">{t("exportTitre")}</h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("exportDescription")}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <p className="text-[length:var(--taille-sm)] font-medium">{t("raccourcis")}</p>
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS_PERIODE.map((raccourci: RaccourciPeriode) => (
            <Button
              key={raccourci}
              variante="secondaire"
              taille="sm"
              onClick={() => onPeriode(periodeDe(raccourci))}
            >
              {t(`periode.${raccourci}` as never)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => lancer("PDF")} disabled={periodeManquante || exporter.isPending}>
          {t("exporterPdf")}
        </Button>
        <Button
          variante="secondaire"
          onClick={() => lancer("EXCEL")}
          disabled={periodeManquante || exporter.isPending}
        >
          {t("exporterExcel")}
        </Button>
        {/*
          The period is optional to browse but required to export: an archive without a period does
          not say what it contains. Explained here rather than letting the backend return a 400.
        */}
        {periodeManquante ? (
          <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
            {t("periodeObligatoire")}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[length:var(--taille-sm)] font-medium">{t("archivesTitre")}</h3>
        {lignes.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("archivesVide")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-bordure rounded border border-bordure">
            {lignes.map((archive) => (
              <li key={archive.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span className="flex flex-col gap-0.5 text-[length:var(--taille-sm)]">
                  {/*
                    The reference comes first: it is how the archive is referred to; the fingerprint
                    proves it.
                  */}
                  <span className="font-medium">
                    <span className="font-mono">{archive.reference}</span>
                    {" · "}
                    {t("archiveResume", {
                      format: archive.format,
                      debut: archive.dateDebut,
                      fin: archive.dateFin,
                      lignes: archive.lignes,
                    })}
                  </span>
                  <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                    <DateHeureValeur valeur={archive.dateExport} />
                    {" · "}
                    {archive.utilisateurId === null ? "—" : nomUtilisateur(archive.utilisateurId)}
                    {" · "}
                    <PoidsFichier valeur={archive.tailleOctets} />
                  </span>
                  {/*
                    The fingerprint is shown in full but grouped: truncated it would be useless, in
                    one block unreadable.
                  */}
                  <EmpreinteAffichee empreinte={archive.empreinte} />
                </span>
                <Button variante="secondaire" taille="sm" onClick={() => void recuperer(archive.id)}>
                  {t("recuperer")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
