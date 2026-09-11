"use client";

import { Check, FileText, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, DialogueConfirmation } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useConstitutions, useDeciderConstitution } from "@/hooks/useConstitutions";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { TON_STATUT_CONSTITUTION, vuesConstitutions, type CleVueConstitutions } from "@/lib/publications";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { gedService } from "@/services/gedService";
import type { DemandeConstitution } from "@/types/domaine";

/** Longueur de `demande_constitution.motif_rejet` en base. */
const MOTIF_MAX = 255;

async function contenuLettre(documentId: number): Promise<Blob> {
  const document = await gedService.consulter(documentId);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Écran 35 — constitutions de prestataires (UC-INT-05, UC-INT-06). Le SH ouvre sur les demandes à
 * signer ; le juriste suit les siennes et celles de ses collègues. La signature génère la lettre de
 * constitution et la dépose dans la GED du dossier ; un rejet revient au juriste avec son motif.
 */
export function FileConstitutions({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("constitutions");
  const td = useTranslations("domaine");
  const vues = useMemo(() => vuesConstitutions(roles), [roles]);
  const defauts = useMemo(() => ({ vue: vues[0] as string }), [vues]);
  const { filtres, definirFiltre } = useFiltresUrl(defauts);
  const vue: CleVueConstitutions = vues.find((v) => v === filtres.vue) ?? vues[0];
  const requete = useConstitutions(vue === "aSigner" ? "EN_ATTENTE" : null);
  const decider = useDeciderConstitution();
  const peutSigner = peut(roles, "signerConstitution");
  const [signature, setSignature] = useState<DemandeConstitution | null>(null);
  const [rejet, setRejet] = useState<DemandeConstitution | null>(null);
  const [lettre, setLettre] = useState<DemandeConstitution | null>(null);

  async function signer() {
    if (!signature) return;
    try {
      await decider.mutateAsync({ id: signature.id, decision: { decision: "VALIDEE" } });
      toast.success(t("signee"));
    } catch (e) {
      toast.error(messageErreur(e));
    } finally {
      setSignature(null);
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
        {vues.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={v === vue}
            onClick={() => definirFiltre("vue", v)}
            className={cn(
              "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
              v === vue ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
            )}
          >
            {t(`vues.${v}` as never)}
          </button>
        ))}
      </div>

      {requete.isLoading ? (
        <EtatChargement lignes={5} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : demandes.length === 0 ? (
        <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
          {vue === "aSigner" ? t("videASigner") : t("vide")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDossier")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePrestataire")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDemandeur")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneMotif")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneStatut")}</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">{t("colonneActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {demandes.map((demande) => {
                const enAttente = demande.statut === "EN_ATTENTE";
                return (
                  <tr key={demande.id}>
                    <td className="px-4 py-2">
                      <Link href={`/dossiers/${demande.dossierId}`} className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4">
                        {demande.referenceDossier}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">{demande.prestataireNom}</span>
                        <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                          {td(`TypeIntervenant.${demande.prestataireType}` as never)}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-col gap-0.5">
                        <span>{demande.demandeurNom ?? "—"}</span>
                        <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                          <DateHeureValeur valeur={demande.dateDemande} />
                        </span>
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-2">{demande.motif}</td>
                    <td className="px-4 py-2">
                      <span className="flex flex-col items-start gap-1">
                        <StatutChip ton={TON_STATUT_CONSTITUTION[demande.statut]}>
                          {td(`StatutConstitution.${demande.statut}` as never)}
                        </StatutChip>
                        {!enAttente && demande.dateDecision ? (
                          <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                            {demande.valideParNom ? `${demande.valideParNom} · ` : ""}
                            <DateHeureValeur valeur={demande.dateDecision} />
                          </span>
                        ) : null}
                        {demande.motifRejet ? (
                          <span className="text-[length:var(--taille-xs)]">{t("motifRejet", { motif: demande.motifRejet })}</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {enAttente && peutSigner ? (
                          <>
                            <Button taille="sm" onClick={() => setSignature(demande)} aria-label={t("signerAria", { prestataire: demande.prestataireNom })}>
                              <Check size={14} aria-hidden />
                              {t("signer")}
                            </Button>
                            <Button
                              variante="secondaire"
                              taille="sm"
                              onClick={() => setRejet(demande)}
                              aria-label={t("rejeterAria", { prestataire: demande.prestataireNom })}
                            >
                              <X size={14} aria-hidden />
                              {t("rejeter")}
                            </Button>
                          </>
                        ) : null}
                        {demande.lettreDocumentId !== null ? (
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setLettre(demande)}
                            aria-label={t("lettreAria", { dossier: demande.referenceDossier })}
                          >
                            <FileText size={14} aria-hidden />
                            {t("lettre")}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DialogueConfirmation
        ouvert={signature !== null}
        onFermeture={() => setSignature(null)}
        onConfirmation={() => void signer()}
        titre={t("signerTitre")}
        message={
          signature
            ? t(signature.prestataireType === "AVOCAT" ? "signerMessageAvocat" : "signerMessageAutre", {
                prestataire: signature.prestataireNom,
                dossier: signature.referenceDossier,
              })
            : ""
        }
        libelleConfirmation={t("signer")}
        enCours={decider.isPending}
      />

      <ModaleRejet demande={rejet} onFermeture={() => setRejet(null)} />

      <ApercuFichier
        ouvert={lettre !== null}
        onFermeture={() => setLettre(null)}
        nomFichier={lettre ? `lettre-constitution-${lettre.id}.pdf` : ""}
        obtenir={() =>
          lettre?.lettreDocumentId ? contenuLettre(lettre.lettreDocumentId) : Promise.reject(new Error("aucune lettre"))
        }
      />
    </div>
  );
}

/** UC-INT-06 alt. 5-a : la demande retourne au juriste avec le motif ; aucune lettre n'est envoyée. */
function ModaleRejet({ demande, onFermeture }: { demande: DemandeConstitution | null; onFermeture: () => void }) {
  const t = useTranslations("constitutions");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const decider = useDeciderConstitution();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pour, setPour] = useState<number | null>(null);

  // Réinitialiser à chaque ouverture sur une autre demande.
  if (demande && demande.id !== pour) {
    setPour(demande.id);
    setMotif("");
    setErreur(null);
  }

  async function rejeter() {
    if (!demande) return;
    if (!motif.trim()) {
      setErreur(tm("champObligatoire"));
      return;
    }
    try {
      await decider.mutateAsync({ id: demande.id, decision: { decision: "REJETEE", motifRejet: motif.trim() } });
      toast.success(t("rejetee"));
      setPour(null);
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialog
      ouvert={demande !== null}
      onFermeture={() => {
        setPour(null);
        onFermeture();
      }}
      titre={t("rejetTitre")}
      description={t("rejetDescription")}
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
      <Champ id="motif-rejet-constitution" label={t("champMotifRejet")} obligatoire erreur={erreur ?? undefined}>
        <Textarea
          id="motif-rejet-constitution"
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
