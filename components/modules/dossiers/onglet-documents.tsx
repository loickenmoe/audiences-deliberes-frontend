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
import { useArbitrerPartage, useEtatPartageDossier, usePartagerDocument, useRetirerPartage } from "@/hooks/useGed";
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

/** Le ton de l'état de partage : une pièce partagée est sortie de la banque, et cela doit se voir. */
const TON_PARTAGE: Record<StatutPartageAvocat, TonStatut> = {
  NON: "neutre",
  PROPOSE: "attention",
  PARTAGE: "info",
};

/** Un geste de partage en attente de confirmation : partager, retirer, ou valider. */
type GestePartage = { nature: "partager" | "retirer" | "valider"; document: DocumentDossier };

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
export function OngletDocuments({
  dossierId,
  roles,
  sensible = false,
}: {
  dossierId: number;
  roles: readonly string[];
  /**
   * Dossier sensible (QF-64) : le partage d'un juriste y devient une **proposition** que le DJ ou la
   * DJA valide. C'est le serveur qui en décide ; l'écran ne fait qu'annoncer le bon geste.
   */
  sensible?: boolean;
}) {
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
  // QF-64 : tout juriste partage ; le DJ et la DJA valident sur un dossier sensible.
  const peutPartager = peut(roles, "partagerDocument");
  const peutArbitrerPartage = peut(roles, "arbitrerPartages");
  // Sur un dossier sensible, le geste d'un juriste est une proposition ; celui du DJ, un partage.
  const proposition = sensible && !peutArbitrerPartage;
  /*
   * **Aucun avocat constitué** (QF-65) : signalé en recette - le juriste partageait, lisait
   * « Partagé », et l'avocat ne voyait rien, faute de lettre signée. Le partage n'est pas faux pour
   * autant : il prendra effet à la signature. Mais celui qui partage doit le savoir.
   *
   * `=== false` et non `!` : tant que la réponse n'est pas arrivée, on n'affirme rien.
   */
  const etatPartage = useEtatPartageDossier(dossierId);
  const sansAvocatConstitue = etatPartage.data?.avocatConstitue === false;
  const avertirConstitution = sansAvocatConstitue && (peutPartager || peutArbitrerPartage);
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

  /**
   * Le tirage de la lettre pour le papier préimprimé de la banque (observation métier du
   * 2026-09-25) : la feuille porte déjà logo, colonne et mentions légales, le PDF ne pose que le
   * contenu — aux mêmes emplacements, sans quoi l'impression tomberait à côté.
   *
   * Le fichier archivé n'est pas remplacé : c'est lui qui fait foi, et il reste téléchargeable par
   * le bouton voisin.
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
   * Un geste de partage, une fois confirmé (QF-64). Chacun est confirmé : une pièce qui sort de la
   * banque, ou qui cesse d'être lisible de l'avocat, ne se décide pas d'un clic égaré.
   */
  async function confirmerGeste() {
    if (!geste) return;
    setErreur(null);
    try {
      if (geste.nature === "partager") {
        const resultat = await partager.mutateAsync(geste.document.id);
        // Le serveur dit lequel des deux a eu lieu : c'est lui qui connaît la sensibilité à jour.
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
                <th scope="col" className="px-4 py-2 font-medium">{tdoc("colonnePartage")}</th>
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
                      {peutPartager && (document.partageAvocat ?? "NON") === "NON" ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => setGeste({ nature: "partager", document })}
                          aria-label={`${proposition ? tdoc("proposerPartage") : tdoc("partager")} - ${document.nomFichier}`}
                          title={proposition ? tdoc("proposerPartage") : tdoc("partager")}
                        >
                          <Share2 size={14} aria-hidden />
                        </Button>
                      ) : null}
                      {peutArbitrerPartage && document.partageAvocat === "PROPOSE" ? (
                        <>
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setGeste({ nature: "valider", document })}
                            aria-label={`${tdoc("validerPartage")} - ${document.nomFichier}`}
                            title={tdoc("validerPartage")}
                          >
                            <Check size={14} aria-hidden />
                          </Button>
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setARejeter(document)}
                            aria-label={`${tdoc("rejeterPartage")} - ${document.nomFichier}`}
                            title={tdoc("rejeterPartage")}
                          >
                            <X size={14} aria-hidden />
                          </Button>
                        </>
                      ) : null}
                      {peutPartager && (document.partageAvocat === "PARTAGE" || document.partageAvocat === "PROPOSE") ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => setGeste({ nature: "retirer", document })}
                          aria-label={`${document.partageAvocat === "PROPOSE" ? tdoc("annulerProposition") : tdoc("retirerPartage")} - ${document.nomFichier}`}
                          title={document.partageAvocat === "PROPOSE" ? tdoc("annulerProposition") : tdoc("retirerPartage")}
                        >
                          <Undo2 size={14} aria-hidden />
                        </Button>
                      ) : null}
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
        obtenir={() => (apercu ? contenuDocument(apercu.id) : Promise.reject(new Error("aucun document")))}
      />

      <DialogueConfirmation
        ouvert={geste !== null}
        onFermeture={() => setGeste(null)}
        onConfirmation={() => void confirmerGeste()}
        titre={
          geste?.nature === "retirer"
            ? tdoc("retraitTitre")
            : geste?.nature === "valider"
              ? tdoc("validerPartage")
              : proposition
                ? tdoc("propositionTitre")
                : tdoc("partageTitre")
        }
        message={
          geste?.nature === "retirer"
            ? tdoc("retraitMessage", { nom: geste.document.nomFichier })
            : (proposition && geste?.nature === "partager"
                ? tdoc("propositionMessage", { nom: geste.document.nomFichier })
                : tdoc("partageMessage", { nom: geste?.document.nomFichier ?? "" })) +
              // Le même avertissement qu'au-dessus du tableau, là où la décision se prend.
              (sansAvocatConstitue ? ` ${tdoc("partageSansConstitution")}` : "")
        }
        libelleConfirmation={
          geste?.nature === "retirer"
            ? geste.document.partageAvocat === "PROPOSE"
              ? tdoc("annulerProposition")
              : tdoc("retirerPartage")
            : geste?.nature === "valider"
              ? tdoc("validerPartage")
              : proposition
                ? tdoc("proposerPartage")
                : tdoc("partager")
        }
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
