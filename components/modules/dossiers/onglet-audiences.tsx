"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateValeur, DialogueConfirmation } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import {
  useAnnulerAudience,
  useAudiencesDossier,
  useEnregistrerCompteRendu,
  usePlanifierAudience,
} from "@/hooks/useAudiences";
import type { Langue } from "@/i18n/config";
import { ErreurApi, messageErreur } from "@/lib/api/errors";
import { aujourdhui, demain } from "@/lib/calendrier";
import { peut } from "@/lib/rbac";
import { formaterDate } from "@/lib/utils";
import type { Audience, Dossier, PlanifierAudience } from "@/types/domaine";
import type { StatutAudience } from "@/types/enums";

const TON: Record<StatutAudience, TonStatut> = { PLANIFIEE: "info", TENUE: "succes", ANNULEE: "neutre" };

/**
 * Écran 09 — audiences du dossier, la plus récente d'abord (ordre du backend).
 *
 * Deux règles du backend commandent les actions proposées :
 * · on ne planifie que sur une étape **en cours** (RG-AUD-01) et à une date **future** (RG-AUD-07) ;
 * · le compte rendu n'est recevable qu'**à partir du jour de l'audience**.
 * L'interface n'offre donc ni une étape qui serait refusée, ni un compte rendu sur une audience à
 * venir.
 *
 * Une audience planifiée peut être **annulée**, motif obligatoire (QF-30, Q-76 backend) : elle quitte
 * alors le calendrier et ses rappels. Un renvoi du tribunal = annuler, puis planifier la nouvelle date.
 */
export function OngletAudiences({ dossier, roles }: { dossier: Dossier; roles: readonly string[] }) {
  const t = useTranslations("audiences");
  const tdom = useTranslations("domaine");
  const requete = useAudiencesDossier(dossier.id);
  const peutGerer = peut(roles, "gererAudiences");
  const [planification, setPlanification] = useState(false);
  const [compteRendu, setCompteRendu] = useState<Audience | null>(null);
  const [annulation, setAnnulation] = useState<Audience | null>(null);
  const langue = useLocale() as Langue;

  const etapesEnCours = dossier.etapes.filter((etape) => etape.statutCycleVie === "EN_COURS");
  const libelleEtape = (etapeId: number) => {
    const etape = dossier.etapes.find((candidate) => candidate.id === etapeId);
    return etape ? tdom(`TypeEtape.${etape.type}` as never) : `#${etapeId}`;
  };

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;
  const audiences = requete.data ?? [];

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
                // Recevable le jour même : « pas après aujourd'hui », comme le backend.
                const compteRenduPossible =
                  peutGerer && audience.statut === "PLANIFIEE" && audience.datePlanifiee <= aujourdhui();
                return (
                  <tr key={audience.id} className={audience.statut === "ANNULEE" ? "text-texte-tertiaire" : undefined}>
                    <td className="px-4 py-2 font-medium">
                      <DateValeur valeur={audience.datePlanifiee} />
                    </td>
                    <td className="px-4 py-2">{libelleEtape(audience.etapeId)}</td>
                    <td className="px-4 py-2">
                      <StatutChip ton={TON[audience.statut]}>
                        {tdom(`StatutAudience.${audience.statut}` as never)}
                      </StatutChip>
                    </td>
                    <td className="px-4 py-2">
                      <DateValeur valeur={audience.dateTenue} />
                    </td>
                    <td className="max-w-md px-4 py-2">
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
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
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
            etapes={etapesEnCours.map((etape) => ({ id: etape.id, libelle: libelleEtape(etape.id) }))}
            ouvert={planification}
            onFermeture={() => setPlanification(false)}
          />
          <ModaleCompteRendu dossierId={dossier.id} audience={compteRendu} onFermeture={() => setCompteRendu(null)} />
          <ModaleAnnulation dossierId={dossier.id} audience={annulation} onFermeture={() => setAnnulation(null)} />
        </>
      ) : null}
    </div>
  );
}

function ModalePlanification({
  dossierId,
  etapes,
  ouvert,
  onFermeture,
}: {
  dossierId: number;
  etapes: { id: number; libelle: string }[];
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const planifier = usePlanifierAudience(dossierId);
  // La confirmation d'un doublon rejoue **la demande refusée**, gardée ici telle quelle : relire le
  // formulaire à ce moment-là exposait la date à une réinitialisation intercalée (envoi d'une date
  // vide, 400 « Requête invalide » — e2e F8, le 2026-09-10).
  const [confirmation, setConfirmation] = useState<PlanifierAudience | null>(null);
  const etapeParDefaut = etapes[0]?.id;

  const schema = useMemo(
    () =>
      z.object({
        etapeId: z.coerce.number().int().positive(tm("champObligatoire")),
        // Comparaison de chaînes `YYYY-MM-DD` : l'ordre lexical est l'ordre chronologique.
        datePlanifiee: z.string().min(1, tm("champObligatoire")).refine((date) => date >= demain(), {
          message: tm("champObligatoire"),
        }),
      }),
    [tm],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema) });

  // Réinitialiser à l'ouverture seulement. Dépendre de la liste des étapes — un tableau recréé à
  // chaque rendu du parent — effaçait la saisie à chaque rechargement du dossier.
  useEffect(() => {
    if (ouvert) {
      reset({ etapeId: etapeParDefaut, datePlanifiee: "" });
      setConfirmation(null);
    }
  }, [ouvert, etapeParDefaut, reset]);

  async function envoyer(audience: PlanifierAudience, forcer: boolean) {
    try {
      await planifier.mutateAsync({ audience, forcer });
      toast.success(t("audiencePlanifiee"));
      setConfirmation(null);
      onFermeture();
    } catch (erreur) {
      // ERR-005 : un doublon n'est pas un échec, c'est une demande de confirmation (RG-AUD-06).
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
          <Champ id="audience-date" label={t("champDate")} obligatoire erreur={errors.datePlanifiee?.message}>
            <Input
              id="audience-date"
              type="date"
              min={demain()}
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
          <Textarea id="compte-rendu" rows={6} enErreur={!!errors.compteRendu} {...register("compteRendu")} />
        </Champ>
      </form>
    </Dialog>
  );
}

/** Annulation motivée (QF-30) : le motif est exigé par le backend et reste lisible dans la liste. */
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
          <Textarea id="annulation-motif" rows={4} maxLength={1000} enErreur={!!errors.motif} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}
