"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { DateHeureValeur, PoidsFichier } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { useArchivesAudit, useExporterAudit } from "@/hooks/useAudit";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import { RACCOURCIS_PERIODE, periodeDe, type RaccourciPeriode } from "@/lib/periodes";
import type { FiltresAudit } from "@/services/auditService";
import { auditService } from "@/services/auditService";

/**
 * Extraction de l'audit et archives déjà produites (backend Q-113).
 *
 * **Pourquoi une archive et pas seulement un téléchargement.** Un fichier remis à quelqu'un est un
 * fichier perdu, et un PDF se réédite en trois minutes : remis seul, il ne prouve rien. Chaque
 * extraction est donc scellée — déposée côté serveur, son **empreinte SHA-256 consignée**. On peut
 * alors démontrer, des années plus tard, que le fichier produit est bien celui qui a été scellé.
 *
 * **Les deux formats, jamais l'un ou l'autre** : le PDF produit une pièce figée qu'on remet à un
 * inspecteur, l'Excel une matière qu'on trie et recoupe. Retenir un seul format aurait obligé l'un
 * des deux usages à se contenter d'un outil qui ne lui convient pas.
 *
 * **Les six raccourcis pré-remplissent la période, ils ne la remplacent pas.** La période libre
 * reste : la première inspection qui demande « du 12 mars au 4 juin » ne rentre dans aucune case.
 * Chaque raccourci couvre l'unité calendaire **écoulée** et s'arrête aujourd'hui — « ce mois-ci » ne
 * va pas jusqu'au 31 si l'on est le 12, une archive ne devant pas prétendre couvrir des jours à venir.
 */
export function ExportAudit({
  filtres,
  debut,
  fin,
  onPeriode,
}: {
  filtres: FiltresAudit;
  debut: string;
  fin: string;
  /** Un raccourci renseigne les champs de période de l'écran : il ne lance pas d'export. */
  onPeriode: (periode: { debut: string; fin: string }) => void;
}) {
  const t = useTranslations("audit");
  const { nomUtilisateur } = useLibelles();
  const exporter = useExporterAudit();
  const archives = useArchivesAudit();

  const periodeManquante = !debut || !fin;

  /**
   * La remise au navigateur passe par un lien éphémère plutôt que par une navigation : l'appel
   * porte le jeton d'authentification, qu'un `window.open` n'emporterait pas.
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
          // L'empreinte est annoncée : elle voyage avec le fichier, et se recoupe avec la liste.
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
    } catch (erreur) {
      toast.error(messageErreur(erreur));
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
          La période est facultative pour consulter, obligatoire pour extraire : une archive sans
          période ne dit pas ce qu'elle contient. On l'explique ici plutôt que de laisser le backend
          renvoyer un 400 que l'utilisateur lirait comme une panne.
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
                  <span className="font-medium">
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
                    {archive.utilisateurId !== null ? nomUtilisateur(archive.utilisateurId) : "—"}
                    {" · "}
                    <PoidsFichier valeur={archive.tailleOctets} />
                  </span>
                  {/*
                    L'empreinte est affichée en entier : tronquée, elle ne servirait qu'à décorer.
                    C'est elle qu'un contrôleur recopie pour vérifier le fichier qu'on lui a remis.
                  */}
                  <span className="font-mono text-[length:var(--taille-2xs)] text-texte-tertiaire">
                    {archive.empreinte}
                  </span>
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
