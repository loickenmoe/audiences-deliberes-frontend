"use client";

import { Check, Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateHeureValeur, DialogueConfirmation, Pagination } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useDeciderSuppression, useDemandesSuppression } from "@/hooks/useGed";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import { estTypeConnu } from "@/lib/documents";
import { cn } from "@/lib/utils";
import { gedService } from "@/services/gedService";
import type { DemandeSuppression, StatutSuppression } from "@/types/domaine";

const TON: Record<StatutSuppression, TonStatut> = {
  EN_ATTENTE: "attention",
  APPROUVEE: "neutre",
  REJETEE: "info",
};

/** Length of `demande_suppression.motif_rejet` in the database. */
const MOTIF_MAX = 255;

type Vue = "EN_ATTENTE" | "TOUTES";

async function contenuDocument(documentId: number): Promise<Blob> {
  const document = await gedService.consulter(documentId);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Screen 36 - deletion requests (UC-GED-03). A legal officer cannot delete a document directly:
 * the request waits here for the DJ or DJA decision, with a reminder every 72 hours. The document
 * can be viewed before deciding; a rejection requires a reason, sent to the legal officer.
 * Two views: pending (oldest first, processing order) and all (history, newest first).
 */
export function FileSuppressions() {
  const t = useTranslations("suppressions");
  const [vue, setVue] = useState<Vue>("EN_ATTENTE");
  /*
   * The queue is paginated server-side, ten rows per page. Without pagination controls, the most
   * recent pending requests (oldest-first order) would be unreachable.
   */
  const [page, setPage] = useState(0);
  const requete = useDemandesSuppression(vue === "EN_ATTENTE" ? "EN_ATTENTE" : null, page);
  const decider = useDeciderSuppression();
  const [apercu, setApercu] = useState<DemandeSuppression | null>(null);
  const [approbation, setApprobation] = useState<DemandeSuppression | null>(null);
  const [rejet, setRejet] = useState<DemandeSuppression | null>(null);

  async function approuver() {
    if (!approbation) return;
    try {
      await decider.mutateAsync({ documentId: approbation.documentId });
      toast.success(t("approuvee", { nom: approbation.documentNom }));
    } catch (error_) {
      toast.error(messageErreur(error_));
    } finally {
      setApprobation(null);
    }
  }

  const demandes = requete.data?.content ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("titre")}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <fieldset
                aria-label={t("vue")}
        className="flex w-fit rounded border border-bordure-forte"
      >
        {(["EN_ATTENTE", "TOUTES"] as const).map((valeur) => (
          <button
            key={valeur}
            type="button"
            aria-pressed={valeur === vue}
            onClick={() => {
              setVue(valeur);
              setPage(0);
            }}
            className={cn(
              "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
              valeur === vue ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
            )}
          >
            {valeur === "EN_ATTENTE" ? t("enAttente") : t("toutes")}
          </button>
        ))}
      </fieldset>

      <TableauDemandes
        enChargement={requete.isLoading}
        erreur={requete.error}
        demandes={demandes}
        videTexte={vue === "EN_ATTENTE" ? t("aucuneEnAttente") : t("aucune")}
        onApercu={setApercu}
        onApprobation={setApprobation}
        onRejet={setRejet}
      />

      {/* Shown whenever a next page exists: a silently truncated queue hides requests from the decision maker. */}
      {requete.data && requete.data.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={requete.data.totalPages}
          totalElements={requete.data.totalElements}
          onChangement={setPage}
        />
      ) : null}

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.documentNom ?? ""}
        obtenir={() =>
          apercu ? contenuDocument(apercu.documentId) : Promise.reject(new Error("aucun document"))
        }
      />

      <DialogueConfirmation
        ouvert={approbation !== null}
        onFermeture={() => setApprobation(null)}
        onConfirmation={() => void approuver()}
        titre={t("approbationTitre")}
        message={t("approbationMessage", { nom: approbation?.documentNom ?? "" })}
        libelleConfirmation={t("approuver")}
        destructif
        enCours={decider.isPending}
      />

      <ModaleRejet demande={rejet} onFermeture={() => setRejet(null)} />
    </div>
  );
}

/** Label of a document type: translated when known, as stored otherwise, nothing when absent. */
function useLibelleType() {
  const tdoc = useTranslations("documents");
  return (type: string | null) => {
    if (!type) return null;
    return estTypeConnu(type) ? tdoc(`types.${type}` as never) : type;
  };
}

/** The queue: loading, error, empty, or one row per request. */
function TableauDemandes({
  enChargement,
  erreur,
  demandes,
  videTexte,
  onApercu,
  onApprobation,
  onRejet,
}: Readonly<{
  enChargement: boolean;
  erreur: unknown;
  demandes: readonly DemandeSuppression[];
  videTexte: string;
  onApercu: (demande: DemandeSuppression) => void;
  onApprobation: (demande: DemandeSuppression) => void;
  onRejet: (demande: DemandeSuppression) => void;
}>) {
  const t = useTranslations("suppressions");
  const { nomUtilisateur } = useLibelles();
  const libelleType = useLibelleType();

  if (enChargement) return <EtatChargement lignes={5} />;
  if (erreur) return <EtatErreur message={messageErreur(erreur)} />;
  if (demandes.length === 0) {
    return (
      <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
        {videTexte}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded border border-bordure bg-surface">
      <table className="w-full text-left text-[length:var(--taille-sm)]">
        <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneDocument")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneDossier")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneDemandeur")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneDate")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneStatut")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              <span className="sr-only">{t("colonneActions")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-bordure">
          {demandes.map((demande) => {
            const enAttente = demande.statut === "EN_ATTENTE";
            const type = libelleType(demande.typeDocument);
            return (
              <tr key={demande.id}>
                <td className="px-4 py-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{demande.documentNom}</span>
                    {type ? (
                      <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                        {type}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link
                    href={`/dossiers/${demande.dossierId}?onglet=documents`}
                    className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
                  >
                    {demande.referenceDossier}
                  </Link>
                </td>
                <td className="px-4 py-2">
                  {demande.demandeurId === null ? "—" : nomUtilisateur(demande.demandeurId)}
                </td>
                <td className="px-4 py-2">
                  <span className="flex flex-col gap-0.5">
                    <DateHeureValeur valeur={demande.dateDemande} />
                    {enAttente && demande.dateDerniereRelance ? (
                      <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                        {t("relancee")} <DateHeureValeur valeur={demande.dateDerniereRelance} />
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className="flex flex-col items-start gap-1">
                    <StatutChip ton={TON[demande.statut]}>
                      {t(`statut.${demande.statut}` as never)}
                    </StatutChip>
                    {!enAttente && demande.dateDecision ? (
                      <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                        {demande.valideParId === null
                          ? ""
                          : `${nomUtilisateur(demande.valideParId)} · `}
                        <DateHeureValeur valeur={demande.dateDecision} />
                      </span>
                    ) : null}
                    {demande.motifRejet ? (
                      <span className="text-[length:var(--taille-xs)]">
                        {t("motif", { motif: demande.motifRejet })}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {enAttente ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => onApercu(demande)}
                        aria-label={t("consulterAria", { nom: demande.documentNom })}
                      >
                        <Eye size={14} aria-hidden />
                        {t("consulter")}
                      </Button>
                      <Button
                        taille="sm"
                        onClick={() => onApprobation(demande)}
                        aria-label={t("approuverAria", { nom: demande.documentNom })}
                      >
                        <Check size={14} aria-hidden />
                        {t("approuver")}
                      </Button>
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => onRejet(demande)}
                        aria-label={t("rejeterAria", { nom: demande.documentNom })}
                      >
                        <X size={14} aria-hidden />
                        {t("rejeter")}
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Rejection with a reason (UC-GED-03 alt. 9-a): the document is kept and the legal officer receives the reason. */
function ModaleRejet({
  demande,
  onFermeture,
}: Readonly<{ demande: DemandeSuppression | null; onFermeture: () => void }>) {
  const t = useTranslations("suppressions");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const decider = useDeciderSuppression();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const demandeId = demande?.id;
  useEffect(() => {
    if (demandeId !== undefined) {
      setMotif("");
      setErreur(null);
    }
  }, [demandeId]);

  async function rejeter() {
    if (!demande) return;
    if (!motif.trim()) {
      setErreur(tm("champObligatoire"));
      return;
    }
    try {
      await decider.mutateAsync({ documentId: demande.documentId, motifRejet: motif.trim() });
      toast.success(t("rejetee"));
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialog
      ouvert={demande !== null}
      onFermeture={onFermeture}
      titre={t("rejetTitre")}
      description={t("rejetDescription", { nom: demande?.documentNom ?? "" })}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={decider.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void rejeter()} disabled={decider.isPending}>
            {t("rejeter")}
          </Button>
        </>
      }
    >
      <Champ id="motif-rejet" label={t("champMotifRejet")} obligatoire erreur={erreur ?? undefined}>
        <Textarea
          id="motif-rejet"
          placeholder={t("phMotifRejetSuppression")}
          rows={4}
          maxLength={MOTIF_MAX}
          enErreur={!!erreur}
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
        />
      </Champ>
    </Dialog>
  );
}
