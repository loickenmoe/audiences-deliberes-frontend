"use client";

import { Check, Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateHeureValeur, DialogueConfirmation } from "@/components/metier";
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

const TON: Record<StatutSuppression, TonStatut> = { EN_ATTENTE: "attention", APPROUVEE: "neutre", REJETEE: "info" };

/** Longueur de `demande_suppression.motif_rejet` en base. */
const MOTIF_MAX = 255;

type Vue = "EN_ATTENTE" | "TOUTES";

async function contenuDocument(documentId: number): Promise<Blob> {
  const document = await gedService.consulter(documentId);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Écran 36 — demandes de suppression (UC-GED-03). Un juriste ne supprime pas lui-même une pièce :
 * sa demande attend ici la décision du DJ ou de la DJA, relancée toutes les 72 heures. Le document
 * se consulte avant de décider ; un rejet exige un motif, transmis au juriste.
 *
 * Deux vues : **en attente** (la plus ancienne d'abord, l'ordre de traitement) et **toutes** (l'historique,
 * la plus récente d'abord). Depuis Q-79, chaque demande nomme son fichier et son dossier.
 */
export function FileSuppressions() {
  const t = useTranslations("suppressions");
  const tdoc = useTranslations("documents");
  const [vue, setVue] = useState<Vue>("EN_ATTENTE");
  const requete = useDemandesSuppression(vue === "EN_ATTENTE" ? "EN_ATTENTE" : null);
  const decider = useDeciderSuppression();
  const { nomUtilisateur } = useLibelles();
  const [apercu, setApercu] = useState<DemandeSuppression | null>(null);
  const [approbation, setApprobation] = useState<DemandeSuppression | null>(null);
  const [rejet, setRejet] = useState<DemandeSuppression | null>(null);

  const libelleType = (type: string | null) =>
    !type ? null : estTypeConnu(type) ? tdoc(`types.${type}` as never) : type;

  async function approuver() {
    if (!approbation) return;
    try {
      await decider.mutateAsync({ documentId: approbation.documentId });
      toast.success(t("approuvee", { nom: approbation.documentNom }));
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    } finally {
      setApprobation(null);
    }
  }

  const demandes = requete.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <div role="group" aria-label={t("vue")} className="flex w-fit rounded border border-bordure-forte">
        {(["EN_ATTENTE", "TOUTES"] as const).map((valeur) => (
          <button
            key={valeur}
            type="button"
            aria-pressed={valeur === vue}
            onClick={() => setVue(valeur)}
            className={cn(
              "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
              valeur === vue ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
            )}
          >
            {valeur === "EN_ATTENTE" ? t("enAttente") : t("toutes")}
          </button>
        ))}
      </div>

      {requete.isLoading ? (
        <EtatChargement lignes={5} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : demandes.length === 0 ? (
        <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
          {vue === "EN_ATTENTE" ? t("aucuneEnAttente") : t("aucune")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDocument")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDossier")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDemandeur")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDate")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneStatut")}</th>
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
                        {type ? <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{type}</span> : null}
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
                    <td className="px-4 py-2">{demande.demandeurId !== null ? nomUtilisateur(demande.demandeurId) : "—"}</td>
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
                        <StatutChip ton={TON[demande.statut]}>{t(`statut.${demande.statut}` as never)}</StatutChip>
                        {!enAttente && demande.dateDecision ? (
                          <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                            {demande.valideParId !== null ? `${nomUtilisateur(demande.valideParId)} · ` : ""}
                            <DateHeureValeur valeur={demande.dateDecision} />
                          </span>
                        ) : null}
                        {demande.motifRejet ? (
                          <span className="text-[length:var(--taille-xs)]">{t("motif", { motif: demande.motifRejet })}</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {enAttente ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setApercu(demande)}
                            aria-label={t("consulterAria", { nom: demande.documentNom })}
                          >
                            <Eye size={14} aria-hidden />
                            {t("consulter")}
                          </Button>
                          <Button
                            taille="sm"
                            onClick={() => setApprobation(demande)}
                            aria-label={t("approuverAria", { nom: demande.documentNom })}
                          >
                            <Check size={14} aria-hidden />
                            {t("approuver")}
                          </Button>
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setRejet(demande)}
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
      )}

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.documentNom ?? ""}
        obtenir={() => (apercu ? contenuDocument(apercu.documentId) : Promise.reject(new Error("aucun document")))}
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

/** Rejet motivé (UC-GED-03 alt. 9-a) : le document est conservé, le juriste reçoit le motif. */
function ModaleRejet({ demande, onFermeture }: { demande: DemandeSuppression | null; onFermeture: () => void }) {
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
