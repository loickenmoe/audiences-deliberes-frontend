"use client";

import { Check, FileText, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, DialogueConfirmation, Pagination } from "@/components/metier";
import { ModaleLettre } from "@/components/modules/constitutions/modale-lettre";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useConstitutions, useDeciderConstitution } from "@/hooks/useConstitutions";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import {
  TON_STATUT_CONSTITUTION,
  vuesConstitutions,
  type CleVueConstitutions,
} from "@/lib/publications";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { gedService } from "@/services/gedService";
import type { DemandeConstitution } from "@/types/domaine";

/** Length of `demande_constitution.motif_rejet` in the database. */
const MOTIF_MAX = 255;

async function contenuLettre(documentId: number): Promise<Blob> {
  const document = await gedService.consulter(documentId);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Screen 35 - service provider representation requests (UC-INT-05, UC-INT-06). The SH lands on the
 * requests to sign; the lawyer follows their own and their colleagues'. Signing generates the
 * representation letter and stores it in the case DMS; a rejection goes back to the lawyer with its
 * reason.
 */
export function FileConstitutions({ roles }: Readonly<{ roles: readonly string[] }>) {
  const router = useRouter();
  const t = useTranslations("constitutions");
  const vues = useMemo(() => vuesConstitutions(roles), [roles]);
  const defauts = useMemo(() => ({ vue: vues[0] as string }), [vues]);
  /*
   * `page` comes from the URL rather than local state: switching view resets to the first page, and
   * a shared link shows the queue as its author saw it.
   */
  const { filtres, definirFiltre, page, definirPage } = useFiltresUrl(defauts);
  const vue: CleVueConstitutions = vues.find((v) => v === filtres.vue) ?? vues[0];
  /* The queue is paginated server-side, ten rows per page, oldest first in the "to sign" view. */
  const requete = useConstitutions(vue === "aSigner" ? "EN_ATTENTE" : null, page);
  const decider = useDeciderConstitution();
  const peutSigner = peut(roles, "signerConstitution");
  // The SH corrects the letter before signing, the lawyer drafts it: two roles, one capability,
  // distinct from the one that opens the request.
  const [signature, setSignature] = useState<DemandeConstitution | null>(null);
  const [rejet, setRejet] = useState<DemandeConstitution | null>(null);
  const [lettre, setLettre] = useState<DemandeConstitution | null>(null);
  /** The letter opened in the modal: editable by the lawyer, read-only for the SH. */
  const [lettreOuverte, setLettreOuverte] = useState<number | null>(null);

  /**
   * Signs, then opens the case's Documents tab (`?onglet=documents`), where the signed letter has
   * just been stored.
   * `dossierId` is read before navigating: `setSignature(null)` clears the state.
   */
  async function signer() {
    if (!signature) return;
    const dossierId = signature.dossierId;
    try {
      await decider.mutateAsync({ id: signature.id, decision: { decision: "VALIDEE" } });
      toast.success(t("signee"));
      setSignature(null);
      router.push(`/dossiers/${dossierId}?onglet=documents`);
    } catch (e) {
      toast.error(messageErreur(e));
      setSignature(null);
    }
  }

  const demandes = requete.data?.content ?? [];
  // A lawyer is notified by the application; another provider has no account and gets the letter by hand.
  const cleMessageSignature =
    signature?.prestataireType === "AVOCAT" ? "signerMessageAvocat" : "signerMessageAutre";
  const messageSignature = signature
    ? t(cleMessageSignature, {
        prestataire: signature.prestataireNom,
        dossier: signature.referenceDossier,
      })
    : "";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("titre")}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <fieldset aria-label={t("vue")} className="flex w-fit rounded border border-bordure-forte">
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
      </fieldset>

      <TableauDemandes
        enChargement={requete.isLoading}
        erreur={requete.error}
        demandes={demandes}
        videTexte={vue === "aSigner" ? t("videASigner") : t("vide")}
        peutSigner={peutSigner}
        onLettre={setLettreOuverte}
        onSigner={setSignature}
        onRejeter={setRejet}
        onVoirLettre={setLettre}
      />

      {/*
        Rendered as soon as a next page exists: silently truncating the queue would hide pending
        requests from the signer.
      */}
      {requete.data && requete.data.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={requete.data.totalPages}
          totalElements={requete.data.totalElements}
          onChangement={definirPage}
        />
      ) : null}

      <ModaleLettre
        demandeId={lettreOuverte}
        ouvert={lettreOuverte !== null}
        onFermeture={() => setLettreOuverte(null)}
      />

      <DialogueConfirmation
        ouvert={signature !== null}
        onFermeture={() => setSignature(null)}
        onConfirmation={() => void signer()}
        titre={t("signerTitre")}
        message={messageSignature}
        libelleConfirmation={t("signer")}
        enCours={decider.isPending}
      />

      <ModaleRejet demande={rejet} onFermeture={() => setRejet(null)} />

      <ApercuFichier
        ouvert={lettre !== null}
        onFermeture={() => setLettre(null)}
        nomFichier={lettre ? `lettre-constitution-${lettre.id}.pdf` : ""}
        obtenir={() =>
          lettre?.lettreDocumentId
            ? contenuLettre(lettre.lettreDocumentId)
            : Promise.reject(new Error("aucune lettre"))
        }
      />
    </div>
  );
}

type ActionsSurDemande = {
  peutSigner: boolean;
  onLettre: (demandeId: number) => void;
  onSigner: (demande: DemandeConstitution) => void;
  onRejeter: (demande: DemandeConstitution) => void;
  onVoirLettre: (demande: DemandeConstitution) => void;
};

/** The queue: loading, error, empty, or one row per request. */
function TableauDemandes({
  enChargement,
  erreur,
  demandes,
  videTexte,
  ...actions
}: Readonly<
  {
    enChargement: boolean;
    erreur: unknown;
    demandes: readonly DemandeConstitution[];
    videTexte: string;
  } & ActionsSurDemande
>) {
  const t = useTranslations("constitutions");
  const td = useTranslations("domaine");
  const { peutSigner, onLettre, onSigner, onRejeter, onVoirLettre } = actions;

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
              {t("colonneDossier")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonnePrestataire")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneDemandeur")}
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              {t("colonneMotif")}
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
            const decideur = demande.valideParNom ? `${demande.valideParNom} · ` : "";
            return (
              <tr key={demande.id}>
                <td className="px-4 py-2">
                  <Link
                    href={`/dossiers/${demande.dossierId}`}
                    className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
                  >
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
                        {decideur}
                        <DateHeureValeur valeur={demande.dateDecision} />
                      </span>
                    ) : null}
                    {demande.motifRejet ? (
                      <span className="text-[length:var(--taille-xs)]">
                        {t("motifRejet", { motif: demande.motifRejet })}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <ActionsDemande
                    demande={demande}
                    peutSigner={peutSigner}
                    onLettre={onLettre}
                    onSigner={onSigner}
                    onRejeter={onRejeter}
                    onVoirLettre={onVoirLettre}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** What can be done on one request: draft or read its letter, sign, reject, open the signed letter. */
function ActionsDemande({
  demande,
  peutSigner,
  onLettre,
  onSigner,
  onRejeter,
  onVoirLettre,
}: Readonly<{ demande: DemandeConstitution } & ActionsSurDemande>) {
  const t = useTranslations("constitutions");
  const enAttente = demande.statut === "EN_ATTENTE";
  return (
    <div className="flex justify-end gap-1">
      {enAttente ? (
        /*
         * Same button, two permissions, and the server decides which. The letter
         * belongs to whoever requested the representation: they draft it, the SH
         * corrects it before signing, and anyone else reads it. Deriving this
         * from a role would offer "Draft" to someone who would then get a 403.
         */
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onLettre(demande.id)}
          aria-label={demande.redactionPossible ? t("redigerLettre") : t("consulterLettre")}
        >
          <FileText size={14} aria-hidden />
          {demande.redactionPossible ? t("redigerLettre") : t("consulterLettre")}
        </Button>
      ) : null}
      {enAttente && peutSigner ? (
        <>
          <Button
            taille="sm"
            onClick={() => onSigner(demande)}
            aria-label={t("signerAria", { prestataire: demande.prestataireNom })}
          >
            <Check size={14} aria-hidden />
            {t("signer")}
          </Button>
          <Button
            variante="secondaire"
            taille="sm"
            onClick={() => onRejeter(demande)}
            aria-label={t("rejeterAria", { prestataire: demande.prestataireNom })}
          >
            <X size={14} aria-hidden />
            {t("rejeter")}
          </Button>
        </>
      ) : null}
      {demande.lettreDocumentId === null ? null : (
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onVoirLettre(demande)}
          aria-label={t("lettreAria", { dossier: demande.referenceDossier })}
        >
          <FileText size={14} aria-hidden />
          {t("lettre")}
        </Button>
      )}
    </div>
  );
}

/** UC-INT-06 alt. 5-a: the request goes back to the lawyer with the reason; no letter is sent. */
function ModaleRejet({
  demande,
  onFermeture,
}: Readonly<{ demande: DemandeConstitution | null; onFermeture: () => void }>) {
  const t = useTranslations("constitutions");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const decider = useDeciderConstitution();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pour, setPour] = useState<number | null>(null);

  // Reset each time the dialog opens on another request.
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
      await decider.mutateAsync({
        id: demande.id,
        decision: { decision: "REJETEE", motifRejet: motif.trim() },
      });
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
      <Champ
        id="motif-rejet-constitution"
        label={t("champMotifRejet")}
        obligatoire
        erreur={erreur ?? undefined}
      >
        <Textarea
          id="motif-rejet-constitution"
          placeholder={t("phMotifRejet")}
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
