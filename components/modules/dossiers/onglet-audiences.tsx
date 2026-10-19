"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, FileText, MessageSquareText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EtatChargement, EtatErreur } from "@/components/global";
import { usePublications } from "@/hooks/usePublications";
import type { Publication } from "@/types/domaine";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateValeur, DialogueConfirmation } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import {
  useAnnulerAudience,
  useAudiencesDossier,
  useEnregistrerCompteRendu,
  useModifierNoteAvocat,
  usePlanifierAudience,
} from "@/hooks/useAudiences";
import type { Langue } from "@/i18n/config";
import { ErreurApi, messageErreur } from "@/lib/api/errors";
import { aujourdhui } from "@/lib/calendrier";
import { peut } from "@/lib/rbac";
import { formaterDate } from "@/lib/utils";
import type { Audience, Dossier, PlanifierAudience } from "@/types/domaine";
import type { StatutAudience } from "@/types/enums";

const TON: Record<StatutAudience, TonStatut> = { PLANIFIEE: "info", TENUE: "succes", ANNULEE: "neutre" };

/**
 * Screen 09 - case hearings, most recent first (backend order).
 * Two backend rules drive the available actions:
 * · scheduling only on a step **in progress** (RG-AUD-01), on a date not before the case opening
 *   (RG-AUD-08);
 * · the hearing report is only accepted **from the hearing day onwards**.
 * A scheduled hearing can be **cancelled** with a required reason: it then leaves the calendar and
 * its reminders. A court adjournment = cancel, then schedule the new date.
 */
export function OngletAudiences({ dossier, roles }: { dossier: Dossier; roles: readonly string[] }) {
  const t = useTranslations("audiences");
  const tdom = useTranslations("domaine");
  const requete = useAudiencesDossier(dossier.id);
  const peutGerer = peut(roles, "gererAudiences");

  /*
   * The counsel's report lives in **publications**, linked to the hearing but not held by it;
   * without this join, a hearing reported by the counsel would look empty.
   * Only **validated** publications count: a pending submission is not readable by lawyers.
   */
  const peutVoirPublications = peut(roles, "consulterPublications");
  const publications = usePublications(
    { dossierId: dossier.id, statut: "VALIDE", size: 200 },
    peutVoirPublications,
  );
  const compteRenduAvocatParAudience = new Map<number, Publication>();
  for (const publication of publications.data?.content ?? []) {
    if (publication.type === "CR_AUDIENCE" && publication.audienceId !== null) {
      compteRenduAvocatParAudience.set(publication.audienceId, publication);
    }
  }
  const [planification, setPlanification] = useState(false);
  const [compteRendu, setCompteRendu] = useState<Audience | null>(null);
  const [annulation, setAnnulation] = useState<Audience | null>(null);
  /** The note for the appointed counsel, separate from the internal hearing report. */
  const [note, setNote] = useState<Audience | null>(null);
  const peutEcrireNote = peut(roles, "ecrireNoteAvocat");
  const langue = useLocale() as Langue;

  const etapesEnCours = dossier.etapes.filter((etape) => etape.statutCycleVie === "EN_COURS");
  const libelleEtape = (etapeId: number) => {
    const etape = dossier.etapes.find((candidate) => candidate.id === etapeId);
    return etape ? tdom(`TypeEtape.${etape.type}` as never) : `#${etapeId}`;
  };

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;
  const audiences = requete.data?.content ?? [];

  return (
    <div className="flex flex-col gap-4">
      {peutGerer ? (
        <div className="flex flex-col items-start gap-2">
          <Button onClick={() => setPlanification(true)} disabled={etapesEnCours.length === 0}>
            <CalendarPlus size={15} aria-hidden />
            {t("planifier")}
          </Button>
          {etapesEnCours.length === 0 ? (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneEtapeEnCours")}</p>
          ) : null}
        </div>
      ) : null}

      {audiences.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("aucune")}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDate")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneEtape")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneStatut")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneTenue")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneCompteRendu")}</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">{t("colonneActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {audiences.map((audience) => {
                // Accepted on the same day: "not after today", as in the backend.
                const compteRenduPossible =
                  peutGerer && audience.statut === "PLANIFIEE" && audience.datePlanifiee <= aujourdhui();
                return (
                  <tr key={audience.id} className={audience.statut === "ANNULEE" ? "text-texte-tertiaire" : undefined}>
                    <td className="px-4 py-2 font-medium">
                      <DateValeur valeur={audience.datePlanifiee} />
                    </td>
                    <td className="px-4 py-2">
                      {libelleEtape(audience.etapeId)}
                      {/* Where it sits: an appeal is not heard by the court that ruled. */}
                      {audience.juridiction ? (
                        <span className="block text-[length:var(--taille-xs)] text-texte-tertiaire">
                          {audience.juridiction}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2">
                      <StatutChip ton={TON[audience.statut]}>
                        {tdom(`StatutAudience.${audience.statut}` as never)}
                      </StatutChip>
                    </td>
                    <td className="px-4 py-2">
                      <DateValeur valeur={audience.dateTenue} />
                    </td>
                    <td className="max-w-md px-4 py-2">
                      <div className="flex flex-col gap-1">
                        {audience.compteRendu ? (
                          <p className="line-clamp-2 whitespace-pre-line" title={audience.compteRendu}>
                            {audience.compteRendu}
                          </p>
                        ) : audience.statut === "ANNULEE" && audience.motifAnnulation ? (
                          <p className="line-clamp-2 whitespace-pre-line" title={audience.motifAnnulation}>
                            {t("motifAnnulation", { motif: audience.motifAnnulation })}
                          </p>
                        ) : compteRenduPossible ? (
                          <Button variante="secondaire" taille="sm" onClick={() => setCompteRendu(audience)}>
                            <FileText size={14} aria-hidden />
                            {t("saisirCompteRendu")}
                          </Button>
                        ) : !compteRenduAvocatParAudience.has(audience.id) ? (
                          "—"
                        ) : null}

                        {/*
                          The note to the counsel, kept **separate** from the internal report:
                          mixing them on screen would suggest the counsel reads the report.
                        */}
                        {audience.noteAvocat ? (
                          <p
                            className="line-clamp-2 whitespace-pre-line border-l-2 border-info/50 pl-2 text-[length:var(--taille-xs)] text-texte-secondaire"
                            title={audience.noteAvocat}
                          >
                            <span className="font-medium">{t("noteAvocat")} : </span>
                            {audience.noteAvocat}
                          </p>
                        ) : null}

                        {compteRenduAvocatParAudience.has(audience.id) ? (
                          <Link
                            href={`/publications/${compteRenduAvocatParAudience.get(audience.id)!.id}`}
                            className="text-[length:var(--taille-xs)] text-texte-secondaire underline underline-offset-2"
                          >
                            {t("compteRenduAvocat")}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                      {peutEcrireNote && audience.statut !== "ANNULEE" ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => setNote(audience)}
                          aria-label={t("ecrireNoteAria", { date: formaterDate(audience.datePlanifiee, langue) })}
                          title={t("ecrireNote")}
                        >
                          <MessageSquareText size={14} aria-hidden />
                        </Button>
                      ) : null}
                      {peutGerer && audience.statut === "PLANIFIEE" ? (
                        <Button
                          variante="secondaire"
                          taille="sm"
                          onClick={() => setAnnulation(audience)}
                          aria-label={t("annulerAria", { date: formaterDate(audience.datePlanifiee, langue) })}
                        >
                          {t("annulerAudience")}
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

      {peutGerer ? (
        <>
          <ModalePlanification
            dossierId={dossier.id}
            ouvertureDossier={dossier.createdAt.slice(0, 10)}
            juridictionDuDossier={dossier.juridictionSaisie}
            etapes={etapesEnCours.map((etape) => ({ id: etape.id, libelle: libelleEtape(etape.id) }))}
            ouvert={planification}
            onFermeture={() => setPlanification(false)}
          />
          <ModaleCompteRendu dossierId={dossier.id} audience={compteRendu} onFermeture={() => setCompteRendu(null)} />
          <ModaleAnnulation dossierId={dossier.id} audience={annulation} onFermeture={() => setAnnulation(null)} />
        </>
      ) : null}
      {peutEcrireNote ? (
        <ModaleNoteAvocat dossierId={dossier.id} audience={note} onFermeture={() => setNote(null)} />
      ) : null}
    </div>
  );
}

function ModalePlanification({
  dossierId,
  ouvertureDossier,
  juridictionDuDossier,
  etapes,
  ouvert,
  onFermeture,
}: {
  dossierId: number;
  /** Case opening date, `YYYY-MM-DD`: lower bound of the hearing date (RG-AUD-08). */
  ouvertureDossier: string;
  /** Court seized: the default proposed when scheduling. */
  juridictionDuDossier: string;
  etapes: { id: number; libelle: string }[];
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const planifier = usePlanifierAudience(dossierId);
  // Confirming a duplicate replays **the rejected request**, kept here as is: re-reading the form
  // at that point exposed the date to an intervening reset (sending an empty date, 400 "Invalid
  // request").
  const [confirmation, setConfirmation] = useState<PlanifierAudience | null>(null);
  const etapeParDefaut = etapes[0]?.id;

  // RG-AUD-08: a hearing can be recorded on the same day and afterwards (a hearing held without
  // being entered must be regularizable). The only bound is the case opening, as on the server:
  // both must reject the same thing.
  const schema = useMemo(
    () =>
      z.object({
        etapeId: z.coerce.number().int().positive(tm("champObligatoire")),
        // Comparing `YYYY-MM-DD` strings: lexical order is chronological order.
        datePlanifiee: z
          .string()
          .min(1, tm("champObligatoire"))
          .refine((date) => date >= ouvertureDossier, { message: t("dateAvantOuverture") }),
        // Optional: when left empty, the server uses the case's court.
        juridiction: z.string().trim().max(100).optional(),
      }),
    [tm, t, ouvertureDossier],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema) });

  // Reset on opening only. Depending on the step list (an array recreated on every parent render)
  // would clear the input on every case reload.
  useEffect(() => {
    if (ouvert) {
      reset({ etapeId: etapeParDefaut, datePlanifiee: "", juridiction: juridictionDuDossier });
      setConfirmation(null);
    }
  }, [ouvert, etapeParDefaut, juridictionDuDossier, reset]);

  async function envoyer(audience: PlanifierAudience, forcer: boolean) {
    try {
      await planifier.mutateAsync({ audience, forcer });
      toast.success(t("audiencePlanifiee"));
      setConfirmation(null);
      onFermeture();
    } catch (erreur) {
      // ERR-005: a duplicate is not a failure but a confirmation request (RG-AUD-06).
      if (erreur instanceof ErreurApi && erreur.demandeConfirmation) {
        setConfirmation(audience);
        return;
      }
      setConfirmation(null);
      setError("root", { message: messageErreur(erreur) });
    }
  }

  const soumettre = handleSubmit((valeurs) => envoyer(valeurs, false));

  return (
    <>
      <Dialog
        ouvert={ouvert && confirmation === null}
        onFermeture={onFermeture}
        titre={t("planifier")}
        description={t("planifierDescription")}
        pied={
          <>
            <Button variante="secondaire" onClick={onFermeture} disabled={planifier.isPending}>
              {tc("annuler")}
            </Button>
            <Button onClick={() => void soumettre()} disabled={planifier.isPending}>
              {tc("enregistrer")}
            </Button>
          </>
        }
      >
        <form onSubmit={soumettre} className="flex flex-col gap-4">
          {errors.root ? (
            <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
              {errors.root.message}
            </p>
          ) : null}
          <Champ id="audience-etape" label={t("champEtape")} obligatoire erreur={errors.etapeId?.message}>
            <Select id="audience-etape" enErreur={!!errors.etapeId} {...register("etapeId")}>
              {etapes.map((etape) => (
                <option key={etape.id} value={etape.id}>
                  {etape.libelle}
                </option>
              ))}
            </Select>
          </Champ>
          <Champ
            id="audience-juridiction"
            label={t("champJuridiction")}
            aide={t("champJuridictionAide")}
            erreur={errors.juridiction?.message}
          >
            <Input
              id="audience-juridiction"
              placeholder={t("phAudienceJuridiction")}
              maxLength={100}
              enErreur={!!errors.juridiction}
              {...register("juridiction")}
            />
          </Champ>
          <Champ id="audience-date" label={t("champDate")} obligatoire erreur={errors.datePlanifiee?.message}>
            <Input
              id="audience-date"
              type="date"
              min={ouvertureDossier}
              enErreur={!!errors.datePlanifiee}
              {...register("datePlanifiee")}
            />
          </Champ>
        </form>
      </Dialog>

      <DialogueConfirmation
        ouvert={ouvert && confirmation !== null}
        onFermeture={() => setConfirmation(null)}
        onConfirmation={() => {
          if (confirmation) void envoyer(confirmation, true);
        }}
        titre={t("doublonTitre")}
        message={t("doublonMessage")}
        enCours={planifier.isPending}
      />
    </>
  );
}

function ModaleCompteRendu({
  dossierId,
  audience,
  onFermeture,
}: {
  dossierId: number;
  audience: Audience | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const enregistrer = useEnregistrerCompteRendu(dossierId);

  const schema = useMemo(() => z.object({ compteRendu: z.string().trim().min(1, tm("champObligatoire")) }), [tm]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { compteRendu: "" } });

  useEffect(() => {
    if (audience) reset({ compteRendu: "" });
  }, [audience, reset]);

  const soumettre = handleSubmit(async ({ compteRendu }) => {
    if (!audience) return;
    try {
      await enregistrer.mutateAsync({ audienceId: audience.id, compteRendu: compteRendu.trim() });
      toast.success(t("compteRenduEnregistre"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={audience !== null}
      onFermeture={onFermeture}
      titre={t("compteRenduTitre")}
      description={t("compteRenduDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={enregistrer.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={enregistrer.isPending}>
            {tc("enregistrer")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        {errors.root ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
            {errors.root.message}
          </p>
        ) : null}
        {audience ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
            <DateValeur valeur={audience.datePlanifiee} />
          </p>
        ) : null}
        <Champ id="compte-rendu" label={t("champCompteRendu")} obligatoire erreur={errors.compteRendu?.message}>
          <Textarea id="compte-rendu"
  placeholder={t("phCompteRendu")} rows={6} enErreur={!!errors.compteRendu} {...register("compteRendu")} />
        </Champ>
      </form>
    </Dialog>
  );
}

/** Cancellation with a reason: required by the backend and shown in the list. */
function ModaleAnnulation({
  dossierId,
  audience,
  onFermeture,
}: {
  dossierId: number;
  audience: Audience | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const annuler = useAnnulerAudience(dossierId);

  const schema = useMemo(
    () => z.object({ motif: z.string().trim().min(1, tm("champObligatoire")).max(1000) }),
    [tm],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { motif: "" } });

  useEffect(() => {
    if (audience) reset({ motif: "" });
  }, [audience, reset]);

  const soumettre = handleSubmit(async ({ motif }) => {
    if (!audience) return;
    try {
      await annuler.mutateAsync({ audienceId: audience.id, motif: motif.trim() });
      toast.success(t("audienceAnnulee"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={audience !== null}
      onFermeture={onFermeture}
      titre={t("annulationTitre")}
      description={t("annulationDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={annuler.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={annuler.isPending}>
            {t("confirmerAnnulation")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        {errors.root ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
            {errors.root.message}
          </p>
        ) : null}
        {audience ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
            <DateValeur valeur={audience.datePlanifiee} />
          </p>
        ) : null}
        <Champ id="annulation-motif" label={t("champMotif")} obligatoire erreur={errors.motif?.message}>
          <Textarea id="annulation-motif"
  placeholder={t("phAnnulationMotif")} rows={4} maxLength={1000} enErreur={!!errors.motif} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}

/**
 * The note for the appointed counsel.
 * Separate from the hearing report, which stays internal: it may assess the strategy or even the
 * counsel's own work (RG-INT-07). The note is written to the counsel and can be entered as soon as
 * the hearing is scheduled.
 * It is edited as written, and **an empty note is deleted**: that is how an obsolete note is
 * removed, without a second button.
 */
function ModaleNoteAvocat({
  dossierId,
  audience,
  onFermeture,
}: {
  dossierId: number;
  audience: Audience | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const modifier = useModifierNoteAvocat(dossierId);
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  // The current note, loaded on opening: it is corrected, not rewritten from memory.
  const audienceId = audience?.id;
  const noteEnVigueur = audience?.noteAvocat ?? "";
  useEffect(() => {
    if (audienceId !== undefined) {
      setTexte(noteEnVigueur);
      setErreur(null);
    }
  }, [audienceId, noteEnVigueur]);

  async function enregistrer() {
    if (!audience) return;
    try {
      await modifier.mutateAsync({ audienceId: audience.id, note: texte.trim() });
      toast.success(texte.trim() ? t("noteEnregistree") : t("noteEffacee"));
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialog
      ouvert={audience !== null}
      onFermeture={onFermeture}
      titre={t("noteTitre")}
      description={t("noteDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={modifier.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void enregistrer()} disabled={modifier.isPending}>
            {tc("enregistrer")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {erreur ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
            {erreur}
          </p>
        ) : null}
        {audience ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
            <DateValeur valeur={audience.datePlanifiee} />
          </p>
        ) : null}
        <Champ id="note-avocat" label={t("noteAvocat")} aide={t("noteAide")}>
          <Textarea
            id="note-avocat"
            placeholder={t("phNote")}
            rows={5}
            maxLength={4000}
            value={texte}
            onChange={(evenement) => setTexte(evenement.target.value)}
          />
        </Champ>
      </div>
    </Dialog>
  );
}
