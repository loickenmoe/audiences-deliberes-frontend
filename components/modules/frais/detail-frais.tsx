"use client";

import { ArrowLeft, Banknote, Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, DialogueConfirmation, MontantFcfa } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useDecisionFrais, useDemandeFrais, usePaiementFrais, type EtapeDecision } from "@/hooks/useFrais";
import type { Langue } from "@/i18n/config";
import { messageErreur } from "@/lib/api/errors";
import { TON_STATUT_FRAIS, aDonneSonAccord, etapeConjointeDe } from "@/lib/frais";
import { peut } from "@/lib/rbac";
import { formaterFcfa } from "@/lib/utils";
import type { DemandeFrais } from "@/types/domaine";
import type { EtapeValidationFrais, StatutCircuitFrais } from "@/types/enums";

/** Longueur de `validation_frais.motif` en base. */
const MOTIF_MAX = 255;

type EtapeCircuit = "DEPOT" | EtapeValidationFrais | "PAIEMENT";

const EN_COURS: readonly StatutCircuitFrais[] = ["DEPOSEE", "CONFORMITE", "OPPORTUNITE"];

/**
 * Écran 29 — détail d'une demande de frais et action de circuit (UC-INT-02/03/04).
 *
 * La demande montre ce qui fonde la décision : montant, pièces déclarées, et la règle RG-INT-03
 * appliquée (dossier sensible ou montant au-delà du seuil). Le circuit liste chaque décision —
 * qui, quand, avec quel motif —, ce qui permet au DJ de voir l'accord déjà donné par la DJA. Une
 * seule action est proposée, celle qui revient au profil à cette étape.
 */
export function DetailFrais({ demandeId, roles }: { demandeId: number; roles: readonly string[] }) {
  const t = useTranslations("frais");
  const td = useTranslations("domaine");
  const langue = useLocale() as Langue;
  const requete = useDemandeFrais(demandeId);

  if (requete.isLoading) return <EtatChargement lignes={6} />;
  if (requete.error || !requete.data) return <EtatErreur message={messageErreur(requete.error)} />;

  const demande = requete.data;
  const seuil = formaterFcfa(demande.seuilApplicable, langue);
  const raison = !demande.validationConjointeRequise
    ? t("sousSeuil", { seuil })
    : demande.dossierSensible
      ? t("motifSensible")
      : t("motifSeuil", { seuil });

  return (
    <div className="flex flex-col gap-5">
      <Link href="/frais" className="flex w-fit items-center gap-1 text-[length:var(--taille-sm)] underline underline-offset-4">
        <ArrowLeft size={14} aria-hidden />
        {t("retour")}
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("titreDetail", { reference: demande.referenceFacture })}
        </h1>
        <StatutChip ton={TON_STATUT_FRAIS[demande.statutCircuit]}>
          {td(`StatutCircuitFrais.${demande.statutCircuit}` as never)}
        </StatutChip>
      </header>

      {demande.statutCircuit === "REJETEE" && demande.motifRejet ? (
        <p className="rounded border border-danger/35 bg-danger-fond px-4 py-3 text-danger">
          {t("rejeteeBandeau", { motif: demande.motifRejet })}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="frais-resume" className="flex flex-col gap-4 rounded border border-bordure bg-surface p-4">
          <h2 id="frais-resume" className="font-semibold">{t("resume")}</h2>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[length:var(--taille-sm)]">
            <dt className="text-texte-secondaire">{t("dossier")}</dt>
            <dd>
              {peut(roles, "consulterDossiers") ? (
                <Link href={`/dossiers/${demande.dossierId}`} className="font-mono underline underline-offset-4">
                  {demande.referenceDossier}
                </Link>
              ) : (
                <span className="font-mono">{demande.referenceDossier}</span>
              )}
            </dd>
            <dt className="text-texte-secondaire">{t("avocat")}</dt>
            <dd>{demande.avocatNom}</dd>
            <dt className="text-texte-secondaire">{t("montant")}</dt>
            <dd><MontantFcfa valeur={demande.montant} /></dd>
            <dt className="text-texte-secondaire">{t("referenceFacture")}</dt>
            <dd className="font-mono">{demande.referenceFacture}</dd>
            <dt className="text-texte-secondaire">{t("deposee")}</dt>
            <dd><DateHeureValeur valeur={demande.createdAt} /></dd>
            <dt className="text-texte-secondaire">{t("paiement")}</dt>
            <dd>{td(`StatutPaiementFrais.${demande.statutPaiement}` as never)}</dd>
          </dl>

          <div className="flex flex-col gap-2">
            <h3 className="text-[length:var(--taille-sm)] font-semibold">{t("pieces")}</h3>
            <ul className="list-inside list-disc text-[length:var(--taille-sm)]">
              {demande.piecesJustificatives.map((piece) => (
                <li key={piece}>{piece}</li>
              ))}
            </ul>
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("piecesAide")}</p>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="frais-circuit" className="flex flex-col gap-3 rounded border border-bordure bg-surface p-4">
            <h2 id="frais-circuit" className="font-semibold">{t("circuit")}</h2>
            <p className="text-[length:var(--taille-sm)]">
              <span className="font-medium">
                {demande.validationConjointeRequise ? t("conjointeOui") : t("conjointeNon")}
              </span>
              {" — "}
              <span className="text-texte-secondaire">{raison}</span>
            </p>
            <Circuit demande={demande} />
          </section>

          <PanneauActions demande={demande} roles={roles} />
        </div>
      </div>
    </div>
  );
}

/** Les étapes dans l'ordre, chacune avec sa décision si elle a été prise. */
function Circuit({ demande }: { demande: DemandeFrais }) {
  const t = useTranslations("frais");
  const td = useTranslations("domaine");
  const conjointe =
    demande.validations.some((v) => v.etape === "CONJOINTE_DJ" || v.etape === "CONJOINTE_DJA") ||
    (demande.validationConjointeRequise && EN_COURS.includes(demande.statutCircuit));
  const etapes: EtapeCircuit[] = [
    "DEPOT",
    "CONFORMITE",
    "OPPORTUNITE",
    ...(conjointe ? (["CONJOINTE_DJ", "CONJOINTE_DJA"] as const) : []),
    "PAIEMENT",
  ];
  // Une demande rejetée ne passera plus les étapes suivantes : « — », pas « en attente ».
  const enAttente = demande.statutCircuit === "REJETEE" ? "—" : t("enAttente");

  function etat(etape: EtapeCircuit): ReactNode {
    if (etape === "DEPOT") {
      return (
        <>
          {demande.avocatNom} · <DateHeureValeur valeur={demande.createdAt} />
        </>
      );
    }
    if (etape === "PAIEMENT") {
      return demande.statutPaiement === "PAYEE" ? (
        <StatutChip ton="succes">{td("StatutPaiementFrais.PAYEE")}</StatutChip>
      ) : (
        enAttente
      );
    }
    const validation = demande.validations.find((v) => v.etape === etape);
    if (!validation) return enAttente;
    return (
      <span className="flex flex-col items-start gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <StatutChip ton={validation.decision === "ACCORD" ? "succes" : "danger"}>
            {td(`DecisionValidationFrais.${validation.decision}` as never)}
          </StatutChip>
          <span>
            {validation.utilisateurNom ?? "—"} · <DateHeureValeur valeur={validation.dateValidation} />
          </span>
        </span>
        {validation.motif ? <span>{t("motifRejet", { motif: validation.motif })}</span> : null}
      </span>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-bordure text-[length:var(--taille-sm)]">
      {etapes.map((etape) => (
        <li key={etape} className="flex flex-wrap items-start justify-between gap-2 py-2">
          <span className="font-medium">{t(`etapes.${etape}` as never)}</span>
          <span className="text-texte-secondaire">{etat(etape)}</span>
        </li>
      ))}
    </ol>
  );
}

type Action = EtapeDecision | "paiement";

/** L'action qui revient à ce profil, à cette étape — et à personne d'autre. */
function actionDisponible(demande: DemandeFrais, roles: readonly string[]): Action | null {
  switch (demande.statutCircuit) {
    case "DEPOSEE":
      return peut(roles, "controlerConformiteFrais") ? "conformite" : null;
    case "CONFORMITE":
      return peut(roles, "controlerOpportuniteFrais") ? "opportunite" : null;
    case "OPPORTUNITE":
      return peut(roles, "validerConjointementFrais") && etapeConjointeDe(roles) ? "conjointe" : null;
    case "VALIDEE":
      return peut(roles, "enregistrerPaiementFrais") ? "paiement" : null;
    default:
      return null;
  }
}

const LIBELLES: Record<Action, { accord: string; titre: string; message: string }> = {
  conformite: { accord: "transmettre", titre: "transmettreTitre", message: "transmettreMessage" },
  opportunite: { accord: "valider", titre: "validerTitre", message: "validerMessage" },
  conjointe: { accord: "donnerAccord", titre: "accordTitre", message: "accordMessage" },
  paiement: { accord: "payer", titre: "payerTitre", message: "payerMessage" },
};

function messageSucces(action: EtapeDecision, statut: StatutCircuitFrais): string {
  if (action === "conformite") return "transmise";
  if (action === "opportunite") return statut === "OPPORTUNITE" ? "conjointeDeclenchee" : "validee";
  return statut === "VALIDEE" ? "accordEnregistreValidee" : "accordEnregistre";
}

function PanneauActions({ demande, roles }: { demande: DemandeFrais; roles: readonly string[] }) {
  const t = useTranslations("frais");
  const decider = useDecisionFrais();
  const payer = usePaiementFrais();
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [rejet, setRejet] = useState<EtapeDecision | null>(null);

  if (demande.statutCircuit === "REJETEE" || demande.statutCircuit === "PAYEE") return null;

  const action = actionDisponible(demande, roles);
  // Le backend refuserait un second vote du même profil (409) : on ne le propose pas.
  const dejaVote = action === "conjointe" && aDonneSonAccord(demande, roles);
  const libelles = action ? LIBELLES[action] : null;
  // UC-INT-02 alt. 4-a : la DJA sait, avant de valider, que le DJ sera sollicité.
  const message =
    action === "opportunite" && demande.validationConjointeRequise ? "validerMessageConjointe" : libelles?.message;

  async function confirmer() {
    const choisie = confirmation;
    if (!choisie) return;
    try {
      if (choisie === "paiement") {
        await payer.mutateAsync(demande.id);
        toast.success(t("payee"));
      } else {
        const resultat = await decider.mutateAsync({ etape: choisie, id: demande.id, decision: { accord: true } });
        toast.success(t(messageSucces(choisie, resultat.statutCircuit) as never));
      }
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    } finally {
      setConfirmation(null);
    }
  }

  let contenu: ReactNode;
  if (!action) {
    contenu = <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneAction")}</p>;
  } else if (dejaVote) {
    contenu = (
      <p className="text-[length:var(--taille-sm)]">
        {t(etapeConjointeDe(roles) === "CONJOINTE_DJ" ? "attenteDja" : "attenteDj")}
      </p>
    );
  } else {
    contenu = (
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirmation(action)}>
          {action === "paiement" ? <Banknote size={15} aria-hidden /> : <Check size={15} aria-hidden />}
          {t(libelles!.accord as never)}
        </Button>
        {action !== "paiement" ? (
          <Button variante="secondaire" onClick={() => setRejet(action)}>
            <X size={15} aria-hidden />
            {t(action === "conjointe" ? "refuser" : "rejeter")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <section aria-labelledby="frais-actions" className="flex flex-col gap-3 rounded border border-bordure bg-surface p-4">
      <h2 id="frais-actions" className="font-semibold">{t("actions")}</h2>
      {contenu}

      <DialogueConfirmation
        ouvert={confirmation !== null}
        onFermeture={() => setConfirmation(null)}
        onConfirmation={() => void confirmer()}
        titre={libelles ? t(libelles.titre as never) : ""}
        message={message ? t(message as never) : ""}
        libelleConfirmation={libelles ? t(libelles.accord as never) : ""}
        enCours={decider.isPending || payer.isPending}
      />

      <ModaleRejet demandeId={demande.id} etape={rejet} onFermeture={() => setRejet(null)} />
    </section>
  );
}

/** Rejet motivé, à toute étape (RG-INT-03) : la demande est close, l'avocat reçoit le motif. */
function ModaleRejet({
  demandeId,
  etape,
  onFermeture,
}: {
  demandeId: number;
  etape: EtapeDecision | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("frais");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const decider = useDecisionFrais();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (etape !== null) {
      setMotif("");
      setErreur(null);
    }
  }, [etape]);

  async function rejeter() {
    if (!etape) return;
    if (!motif.trim()) {
      setErreur(tm("champObligatoire"));
      return;
    }
    try {
      await decider.mutateAsync({ etape, id: demandeId, decision: { accord: false, motifRejet: motif.trim() } });
      toast.success(t("rejetee"));
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const libelle = t(etape === "conjointe" ? "refuser" : "rejeter");

  return (
    <Dialog
      ouvert={etape !== null}
      onFermeture={onFermeture}
      titre={t("rejetTitre")}
      description={t("rejetDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={decider.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void rejeter()} disabled={decider.isPending}>
            {libelle}
          </Button>
        </>
      }
    >
      <Champ id="motif-rejet-frais" label={t("champMotifRejet")} obligatoire erreur={erreur ?? undefined}>
        <Textarea
          id="motif-rejet-frais"
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
