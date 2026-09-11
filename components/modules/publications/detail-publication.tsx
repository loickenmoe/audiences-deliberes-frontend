"use client";

import { ArrowLeft, Check, Download, Eye, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, DateValeur, DialogueConfirmation } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { useLibellePublication } from "@/components/modules/publications/libelle-publication";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import {
  useCommenterPublication,
  usePublication,
  useTransmettreCorrespondance,
  useValiderPublication,
} from "@/hooks/usePublications";
import { ErreurApi, messageErreur } from "@/lib/api/errors";
import { telechargerBlob } from "@/lib/documents";
import { TON_STATUT_PUBLICATION, estCentralisateur, peutCommenter } from "@/lib/publications";
import { peut } from "@/lib/rbac";
import { publicationService } from "@/services/publicationService";
import type { Publication } from "@/types/domaine";

/** Longueur de `publication.motif_rejet` en base. */
const MOTIF_MAX = 255;

/**
 * Écran 32 — une publication d'avocat, et ce qu'on en fait selon son profil (UC-INT-08, UC-INT-10) :
 * l'Assistante la valide ou la rejette ; un juriste la commente pour le DJ et la DJA, jamais pour
 * l'avocat ; le DJ ou la DJA transmet la correspondance unique à l'avocat (RG-INT-07).
 *
 * Une restriction d'accès désignant un autre juriste rend 403 `ERR-009` : on l'affiche comme un
 * accès restreint, pas comme une panne. Une publication non validée rend 404 à qui n'est pas
 * l'Assistante.
 */
export function DetailPublication({ publicationId, roles }: { publicationId: number; roles: readonly string[] }) {
  const t = useTranslations("publications");
  const td = useTranslations("domaine");
  const libelle = useLibellePublication();
  const requete = usePublication(publicationId);
  const [apercu, setApercu] = useState(false);
  const [erreurFichier, setErreurFichier] = useState<string | null>(null);

  if (requete.isLoading) return <EtatChargement lignes={6} />;
  if (requete.error || !requete.data) {
    const erreur = requete.error;
    if (erreur instanceof ErreurApi && erreur.code === "ERR-009") {
      return <EtatVide titre={t("accesRestreint")} description={t("accesRestreintTexte")} action={<Retour />} />;
    }
    if (erreur instanceof ErreurApi && erreur.statut === 404) {
      return <EtatVide titre={t("introuvable")} description={t("introuvableTexte")} action={<Retour />} />;
    }
    return <EtatErreur message={messageErreur(erreur)} />;
  }

  const publication = requete.data;

  async function telecharger() {
    setErreurFichier(null);
    try {
      telechargerBlob(await publicationService.contenuFichier(publication.id), publication.nomFichier ?? "publication");
    } catch (e) {
      setErreurFichier(messageErreur(e));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Retour />

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{libelle(publication)}</h1>
        <StatutChip ton={TON_STATUT_PUBLICATION[publication.statutValidation]}>
          {td(`StatutPublication.${publication.statutValidation}` as never)}
        </StatutChip>
      </header>

      {publication.statutValidation === "REJETE" && publication.motifRejet ? (
        <p className="rounded border border-danger/35 bg-danger-fond px-4 py-3 text-danger">
          {t("rejeteeBandeau", { motif: publication.motifRejet })}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="publication-resume" className="flex flex-col gap-4 rounded border border-bordure bg-surface p-4">
          <h2 id="publication-resume" className="font-semibold">{t("resume")}</h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[length:var(--taille-sm)]">
            <dt className="text-texte-secondaire">{t("dossier")}</dt>
            <dd>
              <Link href={`/dossiers/${publication.dossierId}`} className="font-mono underline underline-offset-4">
                {publication.referenceDossier}
              </Link>
            </dd>
            <dt className="text-texte-secondaire">{t("avocat")}</dt>
            <dd>{publication.avocatNom}</dd>
            {publication.type === "CR_AUDIENCE" ? (
              <>
                <dt className="text-texte-secondaire">{t("audience")}</dt>
                <dd><DateValeur valeur={publication.audienceDate} /></dd>
              </>
            ) : (
              <>
                <dt className="text-texte-secondaire">{t("typeDocument")}</dt>
                <dd>{publication.typeDocument ? td(`TypeAutrePublication.${publication.typeDocument}` as never) : "—"}</dd>
              </>
            )}
            <dt className="text-texte-secondaire">{t("deposee")}</dt>
            <dd><DateHeureValeur valeur={publication.dateDepot} /></dd>
            <dt className="text-texte-secondaire">{t("restriction")}</dt>
            <dd>{publication.restrictionAccesNom ? t("reservee", { nom: publication.restrictionAccesNom }) : t("restrictionTous")}</dd>
          </dl>

          {publication.type === "CR_AUDIENCE" ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-[length:var(--taille-sm)] font-semibold">{t("contenu")}</h3>
              <p className="whitespace-pre-wrap text-[length:var(--taille-sm)]">{publication.contenu}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <h3 className="text-[length:var(--taille-sm)] font-semibold">{t("fichier")}</h3>
              <div className="flex flex-wrap items-center gap-2 text-[length:var(--taille-sm)]">
                <span className="font-medium">{publication.nomFichier ?? "—"}</span>
                <Button variante="secondaire" taille="sm" onClick={() => setApercu(true)}>
                  <Eye size={14} aria-hidden />
                  {t("consulter")}
                </Button>
                <Button variante="secondaire" taille="sm" onClick={() => void telecharger()}>
                  <Download size={14} aria-hidden />
                  {t("telecharger")}
                </Button>
              </div>
              {erreurFichier ? <p role="alert" className="text-[length:var(--taille-sm)] text-danger">{erreurFichier}</p> : null}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          {publication.statutValidation === "DEPOSE" && peut(roles, "validerPublication") ? (
            <PanneauValidation publication={publication} />
          ) : null}
          {publication.statutValidation === "VALIDE" ? <PanneauEchanges publication={publication} roles={roles} /> : null}
        </div>
      </div>

      <ApercuFichier
        ouvert={apercu}
        onFermeture={() => setApercu(false)}
        nomFichier={publication.nomFichier ?? ""}
        obtenir={() => publicationService.contenuFichier(publication.id)}
      />
    </div>
  );
}

function Retour() {
  const t = useTranslations("publications");
  return (
    <Link href="/publications" className="flex w-fit items-center gap-1 text-[length:var(--taille-sm)] underline underline-offset-4">
      <ArrowLeft size={14} aria-hidden />
      {t("retour")}
    </Link>
  );
}

/** UC-INT-10 : valider rend la publication consultable ; rejeter exige un motif, transmis à l'avocat. */
function PanneauValidation({ publication }: { publication: Publication }) {
  const t = useTranslations("publications");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const valider = useValiderPublication();
  const [confirmation, setConfirmation] = useState(false);
  const [rejet, setRejet] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function accepter() {
    try {
      await valider.mutateAsync({ id: publication.id, decision: { statut: "VALIDE" } });
      toast.success(t("validee"));
    } catch (e) {
      toast.error(messageErreur(e));
    } finally {
      setConfirmation(false);
    }
  }

  async function rejeter() {
    if (!motif.trim()) {
      setErreur(tm("champObligatoire"));
      return;
    }
    try {
      await valider.mutateAsync({ id: publication.id, decision: { statut: "REJETE", motifRejet: motif.trim() } });
      toast.success(t("rejetee"));
      setRejet(false);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <section aria-labelledby="publication-validation" className="flex flex-col gap-3 rounded border border-bordure bg-surface p-4">
      <h2 id="publication-validation" className="font-semibold">{t("validation")}</h2>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirmation(true)}>
          <Check size={15} aria-hidden />
          {t("valider")}
        </Button>
        <Button
          variante="secondaire"
          onClick={() => {
            setMotif("");
            setErreur(null);
            setRejet(true);
          }}
        >
          <X size={15} aria-hidden />
          {t("rejeter")}
        </Button>
      </div>

      <DialogueConfirmation
        ouvert={confirmation}
        onFermeture={() => setConfirmation(false)}
        onConfirmation={() => void accepter()}
        titre={t("validerTitre")}
        message={
          publication.restrictionAccesNom
            ? t("validerMessageRestreinte", { nom: publication.restrictionAccesNom })
            : t("validerMessage")
        }
        libelleConfirmation={t("valider")}
        enCours={valider.isPending}
      />

      <Dialog
        ouvert={rejet}
        onFermeture={() => setRejet(false)}
        titre={t("rejetTitre")}
        description={t("rejetDescription")}
        pied={
          <>
            <Button variante="secondaire" onClick={() => setRejet(false)} disabled={valider.isPending}>
              {tc("annuler")}
            </Button>
            <Button onClick={() => void rejeter()} disabled={valider.isPending}>
              {t("rejeter")}
            </Button>
          </>
        }
      >
        <Champ id="motif-rejet-publication" label={t("champMotifRejet")} obligatoire erreur={erreur ?? undefined}>
          <Textarea
            id="motif-rejet-publication"
            rows={4}
            maxLength={MOTIF_MAX}
            enErreur={!!erreur}
            value={motif}
            onChange={(evenement) => setMotif(evenement.target.value)}
          />
        </Champ>
      </Dialog>
    </section>
  );
}

/**
 * UC-INT-08 : les commentaires des juristes, lus par tous les profils internes ; le formulaire de
 * commentaire pour un juriste ; la correspondance unique pour le DJ et la DJA.
 */
function PanneauEchanges({ publication, roles }: { publication: Publication; roles: readonly string[] }) {
  const t = useTranslations("publications");
  const tm = useTranslations("metier");
  const commenter = useCommenterPublication();
  const transmettre = useTransmettreCorrespondance();
  const [commentaire, setCommentaire] = useState("");
  const [erreurCommentaire, setErreurCommentaire] = useState<string | null>(null);
  const [correspondance, setCorrespondance] = useState("");
  const [erreurCorrespondance, setErreurCorrespondance] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const commentaires = publication.commentaires ?? [];

  async function envoyerCommentaire() {
    if (!commentaire.trim()) {
      setErreurCommentaire(tm("champObligatoire"));
      return;
    }
    try {
      await commenter.mutateAsync({ id: publication.id, contenu: commentaire.trim() });
      toast.success(t("commentaireEnvoye"));
      setCommentaire("");
      setErreurCommentaire(null);
    } catch (e) {
      setErreurCommentaire(messageErreur(e));
    }
  }

  function demanderTransmission() {
    if (!correspondance.trim()) {
      setErreurCorrespondance(tm("champObligatoire"));
      return;
    }
    setErreurCorrespondance(null);
    setConfirmation(true);
  }

  async function envoyerCorrespondance() {
    try {
      await transmettre.mutateAsync({ id: publication.id, contenu: correspondance.trim() });
      toast.success(t("correspondanceEnvoyee"));
      setCorrespondance("");
    } catch (e) {
      setErreurCorrespondance(messageErreur(e));
    } finally {
      setConfirmation(false);
    }
  }

  return (
    <section aria-labelledby="publication-echanges" className="flex flex-col gap-4 rounded border border-bordure bg-surface p-4">
      <h2 id="publication-echanges" className="font-semibold">{t("echanges")}</h2>

      <div className="flex flex-col gap-2">
        <h3 className="text-[length:var(--taille-sm)] font-semibold">{t("commentaires")}</h3>
        {commentaires.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucunCommentaire")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-bordure text-[length:var(--taille-sm)]">
            {commentaires.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-2">
                <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                  {c.auteurNom ?? "—"} · <DateHeureValeur valeur={c.createdAt} />
                </span>
                <span className="whitespace-pre-wrap">{c.contenu}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {peutCommenter(roles) ? (
        <div className="flex flex-col gap-2">
          <Champ id="commentaire-publication" label={t("commenter")} aide={t("commenterAide")} erreur={erreurCommentaire ?? undefined}>
            <Textarea
              id="commentaire-publication"
              rows={3}
              enErreur={!!erreurCommentaire}
              value={commentaire}
              onChange={(evenement) => setCommentaire(evenement.target.value)}
            />
          </Champ>
          <Button className="w-fit" onClick={() => void envoyerCommentaire()} disabled={commenter.isPending}>
            <Send size={15} aria-hidden />
            {t("envoyerDjDja")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h3 className="text-[length:var(--taille-sm)] font-semibold">{t("correspondance")}</h3>
        {publication.correspondance ? (
          <div className="flex flex-col gap-1 text-[length:var(--taille-sm)]">
            <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
              {t("correspondancePar", { nom: publication.correspondance.auteurNom ?? "—" })} ·{" "}
              <DateHeureValeur valeur={publication.correspondance.createdAt} />
            </span>
            <span className="whitespace-pre-wrap">{publication.correspondance.contenu}</span>
          </div>
        ) : estCentralisateur(roles) ? (
          <div className="flex flex-col gap-2">
            <Champ
              id="correspondance-publication"
              label={t("champCorrespondance")}
              aide={t("correspondanceAide")}
              erreur={erreurCorrespondance ?? undefined}
            >
              <Textarea
                id="correspondance-publication"
                rows={4}
                enErreur={!!erreurCorrespondance}
                value={correspondance}
                onChange={(evenement) => setCorrespondance(evenement.target.value)}
              />
            </Champ>
            <Button className="w-fit" onClick={demanderTransmission} disabled={transmettre.isPending}>
              <Send size={15} aria-hidden />
              {t("transmettre")}
            </Button>
          </div>
        ) : (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneCorrespondance")}</p>
        )}
      </div>

      <DialogueConfirmation
        ouvert={confirmation}
        onFermeture={() => setConfirmation(false)}
        onConfirmation={() => void envoyerCorrespondance()}
        titre={t("transmettreTitre")}
        message={t("transmettreMessage")}
        libelleConfirmation={t("transmettre")}
        enCours={transmettre.isPending}
      />
    </section>
  );
}
