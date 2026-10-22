"use client";

import { Check, Download, Eye, FileText, Share2, Trash2, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, StatutChip } from "@/components/global";
import type { TonStatut } from "@/components/global/statut-chip";
import { ModaleRejetPartage } from "@/components/modules/ged/modale-rejet-partage";
import { DateHeureValeur, DialogueConfirmation, PoidsFichier } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Televersement } from "@/components/metier/televersement";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { useDeposerDocument, useDocumentsDossier, useSupprimerDocument } from "@/hooks/useDossiers";
import {
  useArbitrerPartage,
  useEtatPartageDossier,
  usePartagerDocument,
  useRetirerPartage,
} from "@/hooks/useGed";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import {
  estTypeConnu,
  telechargerBlob,
  TYPE_LETTRE_CONSTITUTION,
  TypesDocument,
  type TypeDocument,
} from "@/lib/documents";
import { constitutionService } from "@/services/constitutionService";
import { peut } from "@/lib/rbac";
import { gedService } from "@/services/gedService";
import type { DocumentDossier, StatutPartageAvocat } from "@/types/domaine";

/** Tone of the sharing state: a shared document has left the bank, and that must be visible. */
const TON_PARTAGE: Record<StatutPartageAvocat, TonStatut> = {
  NON: "neutre",
  PROPOSE: "attention",
  PARTAGE: "info",
};

/** A sharing action awaiting confirmation: share, withdraw or validate. */
type GestePartage = { nature: "partager" | "retirer" | "valider"; document: DocumentDossier };

/**
 * Title, message and button of a sharing confirmation. Withdrawing, validating, proposing and
 * sharing each say what will happen; a share without appointed counsel repeats the warning.
 */
function textesGeste(
  geste: GestePartage | null,
  proposition: boolean,
  sansAvocatConstitue: boolean,
  tdoc: ReturnType<typeof useTranslations<"documents">>,
): { titre: string; message: string; libelleConfirmation: string } {
  const nom = geste?.document.nomFichier ?? "";
  if (geste?.nature === "retirer") {
    return {
      titre: tdoc("retraitTitre"),
      message: tdoc("retraitMessage", { nom }),
      libelleConfirmation:
        geste.document.partageAvocat === "PROPOSE"
          ? tdoc("annulerProposition")
          : tdoc("retirerPartage"),
    };
  }
  // Same warning as above the table, where the decision is made.
  const avertissement = sansAvocatConstitue ? ` ${tdoc("partageSansConstitution")}` : "";
  if (geste?.nature === "valider") {
    return {
      titre: tdoc("validerPartage"),
      message: tdoc("partageMessage", { nom }) + avertissement,
      libelleConfirmation: tdoc("validerPartage"),
    };
  }
  if (proposition) {
    return {
      titre: tdoc("propositionTitre"),
      message: tdoc(geste ? "propositionMessage" : "partageMessage", { nom }) + avertissement,
      libelleConfirmation: tdoc("proposerPartage"),
    };
  }
  return {
    titre: tdoc("partageTitre"),
    message: tdoc("partageMessage", { nom }) + avertissement,
    libelleConfirmation: tdoc("partager"),
  };
}

/** Fetches a document's content: a fresh pre-signed URL, then the file itself. */
async function contenuDocument(id: number): Promise<Blob> {
  const document = await gedService.consulter(id);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Documents tab of the case page: upload, view, download, delete.
 * The source is `GET /dossiers/{id}/documents`, **never** `DossierResponse.documents`, which is
 * always empty. The download URL is only requested when opening a document: it is valid for 10
 * minutes.
 * Deletion follows the backend rule: immediate for the DJ/DJA, a **request** submitted to them for
 * the lawyer who uploaded it. The UI does not know the current user, so a lawyer sees the action on
 * every document and the backend rejects the ones they did not upload, with its own message.
 */
export function OngletDocuments({
  dossierId,
  roles,
  sensible = false,
}: Readonly<{
  dossierId: number;
  roles: readonly string[];
  /**
   * Sensitive case: a lawyer's share becomes a **proposal** that the DJ or DJA validates. The
   * server decides; the screen only labels the right action.
   */
  sensible?: boolean;
}>) {
  const t = useTranslations("fiche");
  const tdoc = useTranslations("documents");
  const requete = useDocumentsDossier(dossierId);
  const supprimer = useSupprimerDocument(dossierId);
  const { nomUtilisateur } = useLibelles();

  const [apercu, setApercu] = useState<DocumentDossier | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentDossier | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [geste, setGeste] = useState<GestePartage | null>(null);
  const [aRejeter, setARejeter] = useState<DocumentDossier | null>(null);
  const partager = usePartagerDocument();
  const retirer = useRetirerPartage();
  const arbitrer = useArbitrerPartage();

  const peutDeposer = peut(roles, "deposerDocument");
  // Any lawyer can share; the DJ and DJA validate on a sensitive case.
  const peutPartager = peut(roles, "partagerDocument");
  const peutArbitrerPartage = peut(roles, "arbitrerPartages");
  // On a sensitive case, a lawyer's action is a proposal; the DJ's is a share.
  const proposition = sensible && !peutArbitrerPartage;
  /*
   * **No appointed counsel**: sharing still works but only takes effect once the representation
   * letter is signed, and the person sharing must know it.
   * `=== false` rather than `!`: nothing is asserted until the response has arrived.
   */
  const etatPartage = useEtatPartageDossier(dossierId);
  const sansAvocatConstitue = etatPartage.data?.avocatConstitue === false;
  const avertirConstitution = sansAvocatConstitue && (peutPartager || peutArbitrerPartage);
  const peutSupprimer = peut(roles, "supprimerDocument");
  // The DJ/DJA delete directly; other profiles only submit a request.
  const suppressionDirecte = peut(roles, "arbitrerSuppressions");

  function libelleType(type: string | null) {
    if (!type) return "—";
    return estTypeConnu(type) ? tdoc(`types.${type}` as never) : type;
  }

  async function telecharger(document: DocumentDossier) {
    setErreur(null);
    try {
      telechargerBlob(await contenuDocument(document.id), document.nomFichier);
    } catch (e) {
      setErreur(
        e instanceof Error && e.message.startsWith("Stockage")
          ? tdoc("apercuErreur")
          : messageErreur(e),
      );
    }
  }

  /**
   * Letter rendering for the bank's preprinted paper: the sheet already carries logo, column and
   * legal notices, so the PDF only places the content at the same positions.
   * The archived file is not replaced: it is the authoritative version and remains downloadable
   * from the neighbouring button.
   */
  async function telechargerSansEntete(document: DocumentDossier) {
    setErreur(null);
    try {
      const pdf = await constitutionService.lettrePourPapierPreimprime(document.id);
      telechargerBlob(pdf, document.nomFichier.replace(/.pdf$/i, "") + "-sans-entete.pdf");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  /**
   * A sharing action, once confirmed. Each one is confirmed: a document leaving the bank, or no
   * longer readable by the counsel, must not be decided by a stray click.
   */
  async function confirmerGeste() {
    if (!geste) return;
    setErreur(null);
    try {
      if (geste.nature === "partager") {
        const resultat = await partager.mutateAsync(geste.document.id);
        // The server says which of the two happened: it knows the up-to-date sensitivity.
        toast.success(resultat.partageAvocat === "PROPOSE" ? tdoc("proposee") : tdoc("partagee"));
      } else if (geste.nature === "retirer") {
        await retirer.mutateAsync(geste.document.id);
        toast.success(tdoc("partageRetire"));
      } else {
        await arbitrer.mutateAsync({ documentId: geste.document.id });
        toast.success(tdoc("partageValide"));
      }
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setGeste(null);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setErreur(null);
    try {
      const resultat = await supprimer.mutateAsync(aSupprimer.id);
      toast.success(resultat.immediate ? tdoc("documentSupprime") : tdoc("demandeEnvoyee"));
    } catch (e) {
      // 403: lawyer is not the uploader. 409: a request is already pending. The backend message
      // says which.
      setErreur(messageErreur(e));
    } finally {
      setASupprimer(null);
    }
  }

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;

  // Deleted documents remain in the response, flagged: they must not be shown here.
  const documents = (requete.data?.content ?? []).filter((document) => !document.estSupprime);

  return (
    <div className="flex flex-col gap-5">
      {peutDeposer ? <DepotPiece dossierId={dossierId} /> : null}

      {avertirConstitution ? (
        <p
          role="note"
          className="rounded border border-attention/40 bg-attention-fond px-4 py-3 text-[length:var(--taille-sm)] text-attention"
        >
          {tdoc("aucunAvocatConstitue")}
        </p>
      ) : null}

      {erreur ? (
        <p
          role="alert"
          className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger"
        >
          {erreur}
        </p>
      ) : null}

      {documents.length === 0 ? (
        <div className="flex flex-col gap-1 rounded border border-dashed border-bordure-forte px-6 py-10 text-center">
          <p className="font-medium">{t("documentsVide")}</p>
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
            {t("documentsVideTexte")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("colonneFichier")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {tdoc("colonneType")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("colonneFormat")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("colonnePoids")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("colonneDepot")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {t("colonneAuteur")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  {tdoc("colonnePartage")}
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">{tdoc("colonneActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="px-4 py-2">{document.nomFichier}</td>
                  <td className="px-4 py-2">{libelleType(document.typeDocument)}</td>
                  <td className="px-4 py-2 font-mono text-[length:var(--taille-xs)]">
                    {document.format}
                  </td>
                  <td className="px-4 py-2">
                    <PoidsFichier valeur={document.poids} />
                  </td>
                  <td className="px-4 py-2">
                    <DateHeureValeur valeur={document.dateChargement} />
                  </td>
                  <td className="px-4 py-2">
                    {document.auteurChargementId === null
                      ? "—"
                      : nomUtilisateur(document.auteurChargementId)}
                  </td>
                  <td className="px-4 py-2">
                    <StatutChip ton={TON_PARTAGE[document.partageAvocat ?? "NON"]}>
                      {tdoc(`partage${document.partageAvocat ?? "NON"}` as never)}
                    </StatutChip>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => setApercu(document)}
                        aria-label={`${tdoc("consulter")} - ${document.nomFichier}`}
                      >
                        <Eye size={14} aria-hidden />
                        {tdoc("consulter")}
                      </Button>
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => void telecharger(document)}
                        aria-label={`${tdoc("telecharger")} - ${document.nomFichier}`}
                      >
                        <Download size={14} aria-hidden />
                      </Button>
                      {document.typeDocument === TYPE_LETTRE_CONSTITUTION ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => void telechargerSansEntete(document)}
                          aria-label={`${tdoc("telechargerSansEntete")} - ${document.nomFichier}`}
                          title={tdoc("telechargerSansEnteteAide")}
                        >
                          <FileText size={14} aria-hidden />
                        </Button>
                      ) : null}
                      <ActionsPartage
                        document={document}
                        peutPartager={peutPartager}
                        peutArbitrer={peutArbitrerPartage}
                        proposition={proposition}
                        onGeste={(nature) => setGeste({ nature, document })}
                        onRejet={() => setARejeter(document)}
                      />
                      {peutSupprimer ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => setASupprimer(document)}
                          aria-label={`${suppressionDirecte ? tdoc("supprimer") : tdoc("demanderSuppression")} - ${document.nomFichier}`}
                        >
                          <Trash2 size={14} aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.nomFichier ?? ""}
        obtenir={() =>
          apercu ? contenuDocument(apercu.id) : Promise.reject(new Error("aucun document"))
        }
      />

      <DialogueConfirmation
        ouvert={geste !== null}
        onFermeture={() => setGeste(null)}
        onConfirmation={() => void confirmerGeste()}
        {...textesGeste(geste, proposition, sansAvocatConstitue, tdoc)}
        enCours={partager.isPending || retirer.isPending || arbitrer.isPending}
      />

      <ModaleRejetPartage
        piece={aRejeter ? { documentId: aRejeter.id, nomFichier: aRejeter.nomFichier } : null}
        onFermeture={() => setARejeter(null)}
      />

      <DialogueConfirmation
        ouvert={aSupprimer !== null}
        onFermeture={() => setASupprimer(null)}
        onConfirmation={() => void confirmerSuppression()}
        titre={suppressionDirecte ? tdoc("suppressionTitre") : tdoc("demandeSuppressionTitre")}
        message={
          suppressionDirecte
            ? tdoc("suppressionMessage", { nom: aSupprimer?.nomFichier ?? "" })
            : tdoc("demandeSuppressionMessage", { nom: aSupprimer?.nomFichier ?? "" })
        }
        libelleConfirmation={suppressionDirecte ? tdoc("supprimer") : tdoc("demanderSuppression")}
        destructif
        enCours={supprimer.isPending}
      />
    </div>
  );
}

/** Sharing actions on one document, depending on its sharing state and the profile. */
function ActionsPartage({
  document,
  peutPartager,
  peutArbitrer,
  proposition,
  onGeste,
  onRejet,
}: Readonly<{
  document: DocumentDossier;
  peutPartager: boolean;
  peutArbitrer: boolean;
  proposition: boolean;
  onGeste: (nature: GestePartage["nature"]) => void;
  onRejet: () => void;
}>) {
  const tdoc = useTranslations("documents");
  return (
    <>
      {peutPartager && (document.partageAvocat ?? "NON") === "NON" ? (
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onGeste("partager")}
          aria-label={`${proposition ? tdoc("proposerPartage") : tdoc("partager")} - ${document.nomFichier}`}
          title={proposition ? tdoc("proposerPartage") : tdoc("partager")}
        >
          <Share2 size={14} aria-hidden />
        </Button>
      ) : null}
      {peutArbitrer && document.partageAvocat === "PROPOSE" ? (
        <>
          <Button
            variante="secondaire"
            taille="sm"
            onClick={() => onGeste("valider")}
            aria-label={`${tdoc("validerPartage")} - ${document.nomFichier}`}
            title={tdoc("validerPartage")}
          >
            <Check size={14} aria-hidden />
          </Button>
          <Button
            variante="secondaire"
            taille="sm"
            onClick={() => onRejet()}
            aria-label={`${tdoc("rejeterPartage")} - ${document.nomFichier}`}
            title={tdoc("rejeterPartage")}
          >
            <X size={14} aria-hidden />
          </Button>
        </>
      ) : null}
      {peutPartager &&
      (document.partageAvocat === "PARTAGE" || document.partageAvocat === "PROPOSE") ? (
        <Button
          variante="secondaire"
          taille="sm"
          onClick={() => onGeste("retirer")}
          aria-label={`${document.partageAvocat === "PROPOSE" ? tdoc("annulerProposition") : tdoc("retirerPartage")} - ${document.nomFichier}`}
          title={
            document.partageAvocat === "PROPOSE"
              ? tdoc("annulerProposition")
              : tdoc("retirerPartage")
          }
        >
          <Undo2 size={14} aria-hidden />
        </Button>
      ) : null}
    </>
  );
}

/** Uploading a document from the case page: type, file, preview before upload. */
function DepotPiece({ dossierId }: Readonly<{ dossierId: number }>) {
  const tdoc = useTranslations("documents");
  const deposer = useDeposerDocument(dossierId);
  const [type, setType] = useState<TypeDocument>("AUTRE");
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Changing the key remounts `Televersement`, the only way to clear its selection after an upload.
  const [cleChamp, setCleChamp] = useState(0);

  async function envoyer() {
    if (!fichier) return;
    setErreur(null);
    try {
      await deposer.mutateAsync({ typeDocument: type, fichier });
      toast.success(tdoc("pieceDeposee"));
      setFichier(null);
      setCleChamp((cle) => cle + 1);
    } catch (e) {
      // ERR-008: format or size rejected by the backend, explicit message.
      setErreur(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-bordure bg-surface p-4">
      <p className="text-[length:var(--taille-sm)] font-medium">{tdoc("ajouterPiece")}</p>
      <div className="flex flex-wrap items-start gap-4">
        <Champ id="type-piece" label={tdoc("typePiece")} className="w-64">
          <Select
            id="type-piece"
            value={type}
            onChange={(evenement) => setType(evenement.target.value as TypeDocument)}
          >
            {TypesDocument.map((valeur) => (
              <option key={valeur} value={valeur}>
                {tdoc(`types.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>
        <div className="flex flex-wrap items-start gap-3 pt-6">
          <Televersement key={cleChamp} nom="piece-fiche" onChangement={setFichier} />
          {fichier ? (
            <Button variante="secondaire" taille="sm" onClick={() => setApercu(true)}>
              <Eye size={14} aria-hidden />
              {tdoc("apercu")}
            </Button>
          ) : null}
          <Button onClick={() => void envoyer()} disabled={!fichier || deposer.isPending}>
            {tdoc("deposer")}
          </Button>
        </div>
      </div>

      {erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {erreur}
        </p>
      ) : null}

      <ApercuFichier
        ouvert={apercu && fichier !== null}
        onFermeture={() => setApercu(false)}
        nomFichier={fichier?.name ?? ""}
        obtenir={() =>
          fichier ? Promise.resolve(fichier) : Promise.reject(new Error("aucun fichier"))
        }
      />
    </div>
  );
}
