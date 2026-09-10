"use client";

import { Download, Eye, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { DateHeureValeur, DialogueConfirmation, PoidsFichier } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Televersement } from "@/components/metier/televersement";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { useDeposerDocument, useDocumentsDossier, useSupprimerDocument } from "@/hooks/useDossiers";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import { estTypeConnu, telechargerBlob, TypesDocument, type TypeDocument } from "@/lib/documents";
import { peut } from "@/lib/rbac";
import { gedService } from "@/services/gedService";
import type { DocumentDossier } from "@/types/domaine";

/** Récupère le contenu d'un document : URL pré-signée fraîche (#39), puis le fichier lui-même. */
async function contenuDocument(id: number): Promise<Blob> {
  const document = await gedService.consulter(id);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Onglet documents de la fiche : déposer, consulter, télécharger, supprimer.
 *
 * La source est `GET /dossiers/{id}/documents` (#43) et **jamais** `DossierResponse.documents`,
 * vide par construction (Q-67). L'URL de téléchargement n'est demandée qu'au moment d'ouvrir un
 * document : elle ne vit que 10 minutes.
 *
 * La suppression suit la règle du backend (#40) : immédiate pour le DJ/DJA, **demande** soumise à
 * leur décision pour le juriste auteur du dépôt. Faute d'endpoint « utilisateur courant » (QF-27),
 * l'interface ne sait pas qui est l'auteur : un juriste voit l'action sur chaque pièce, et le
 * backend refuse celles qu'il n'a pas déposées, avec son propre message.
 */
export function OngletDocuments({ dossierId, roles }: { dossierId: number; roles: readonly string[] }) {
  const t = useTranslations("fiche");
  const tdoc = useTranslations("documents");
  const requete = useDocumentsDossier(dossierId);
  const supprimer = useSupprimerDocument(dossierId);
  const { nomUtilisateur } = useLibelles();

  const [apercu, setApercu] = useState<DocumentDossier | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentDossier | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const peutDeposer = peut(roles, "deposerDocument");
  const peutSupprimer = peut(roles, "supprimerDocument");
  // Le DJ/DJA supprime directement ; les autres profils ne font qu'une demande.
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
      setErreur(e instanceof Error && e.message.startsWith("Stockage") ? tdoc("apercuErreur") : messageErreur(e));
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setErreur(null);
    try {
      const resultat = await supprimer.mutateAsync(aSupprimer.id);
      toast.success(resultat.immediate ? tdoc("documentSupprime") : tdoc("demandeEnvoyee"));
    } catch (e) {
      // 403 : juriste non auteur. 409 : une demande est déjà en attente. Le message du backend dit
      // précisément lequel.
      setErreur(messageErreur(e));
    } finally {
      setASupprimer(null);
    }
  }

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;

  // Les documents supprimés restent dans la réponse, marqués : ils ne doivent pas s'afficher ici.
  const documents = (requete.data ?? []).filter((document) => !document.estSupprime);

  return (
    <div className="flex flex-col gap-5">
      {peutDeposer ? <DepotPiece dossierId={dossierId} /> : null}

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
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("documentsVideTexte")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneFichier")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{tdoc("colonneType")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneFormat")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePoids")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDepot")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneAuteur")}</th>
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
                  <td className="px-4 py-2 font-mono text-[length:var(--taille-xs)]">{document.format}</td>
                  <td className="px-4 py-2">
                    <PoidsFichier valeur={document.poids} />
                  </td>
                  <td className="px-4 py-2">
                    <DateHeureValeur valeur={document.dateChargement} />
                  </td>
                  <td className="px-4 py-2">
                    {document.auteurChargementId !== null ? nomUtilisateur(document.auteurChargementId) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => setApercu(document)}
                        aria-label={`${tdoc("consulter")} — ${document.nomFichier}`}
                      >
                        <Eye size={14} aria-hidden />
                        {tdoc("consulter")}
                      </Button>
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => void telecharger(document)}
                        aria-label={`${tdoc("telecharger")} — ${document.nomFichier}`}
                      >
                        <Download size={14} aria-hidden />
                      </Button>
                      {peutSupprimer ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => setASupprimer(document)}
                          aria-label={`${suppressionDirecte ? tdoc("supprimer") : tdoc("demanderSuppression")} — ${document.nomFichier}`}
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
        obtenir={() => (apercu ? contenuDocument(apercu.id) : Promise.reject(new Error("aucun document")))}
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

/** Dépôt d'une pièce depuis la fiche : type, fichier, aperçu avant envoi. */
function DepotPiece({ dossierId }: { dossierId: number }) {
  const tdoc = useTranslations("documents");
  const deposer = useDeposerDocument(dossierId);
  const [type, setType] = useState<TypeDocument>("AUTRE");
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Changer la clé remonte `Televersement`, seul moyen de vider sa sélection après un dépôt.
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
      // ERR-008 : format ou poids refusé par le backend, message explicite.
      setErreur(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-bordure bg-surface p-4">
      <p className="text-[length:var(--taille-sm)] font-medium">{tdoc("ajouterPiece")}</p>
      <div className="flex flex-wrap items-start gap-4">
        <Champ id="type-piece" label={tdoc("typePiece")} className="w-64">
          <Select id="type-piece" value={type} onChange={(evenement) => setType(evenement.target.value as TypeDocument)}>
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
        obtenir={() => (fichier ? Promise.resolve(fichier) : Promise.reject(new Error("aucun fichier")))}
      />
    </div>
  );
}
