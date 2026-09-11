"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Gavel, History } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateHeureValeur, DateValeur } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import {
  useDeliberesDossier,
  useEnregistrerDelibere,
  useModifierExpedition,
  useProrogations,
  useProroger,
  useRabattre,
  useRecours,
  useViderDelibere,
} from "@/hooks/useDeliberes";
import type { Langue } from "@/i18n/config";
import { messageErreur } from "@/lib/api/errors";
import { aujourdhui, demain } from "@/lib/calendrier";
import { peut } from "@/lib/rbac";
import { formaterDate } from "@/lib/utils";
import type { Delibere, Dossier } from "@/types/domaine";
import { ResultatDelibere, type EtatDelibere } from "@/types/enums";

const TON_ETAT: Record<EtatDelibere, TonStatut> = { EN_ATTENTE: "attention", VIDE: "info", RABATTU: "neutre" };
const TON_RESULTAT: Record<ResultatDelibere, TonStatut> = { FAVORABLE: "succes", DEFAVORABLE: "danger", MIXTE: "attention" };

type Action = "vider" | "proroger" | "rabattre";

/**
 * Écran 10 — délibérés du dossier, le plus récent d'abord (ordre du backend).
 *
 * Cycle (Q-78, conforme aux sources RG-DEL-06/07, UC-DEL-04/05) : l'affaire est **mise en délibéré**
 * à une date annoncée ; tant que la décision n'est pas rendue, le délibéré peut être **prorogé**
 * (« délibéré prorogé au … ») ou **rabattu** (le juge rouvre les débats) ; quand la décision tombe,
 * on l'enregistre et le délibéré est **vidé**. Viennent alors l'expédition et le délai de recours.
 * L'écran ne propose que les actions recevables à chaque état ; le backend reste l'arbitre.
 */
export function OngletDeliberes({ dossier, roles }: { dossier: Dossier; roles: readonly string[] }) {
  const t = useTranslations("deliberes");
  const tdom = useTranslations("domaine");
  const requete = useDeliberesDossier(dossier.id);
  const peutGerer = peut(roles, "gererDeliberes");
  const [miseEnDelibere, setMiseEnDelibere] = useState(false);
  const [action, setAction] = useState<{ type: Action; delibere: Delibere } | null>(null);
  const [historique, setHistorique] = useState<Delibere | null>(null);

  const libelleEtape = (etapeId: number) => {
    const etape = dossier.etapes.find((candidate) => candidate.id === etapeId);
    return etape ? tdom(`TypeEtape.${etape.type}` as never) : `#${etapeId}`;
  };
  const etapeEnDelibere = (etapeId: number) =>
    dossier.etapes.find((candidate) => candidate.id === etapeId)?.statutCycleVie === "EN_DELIBERE";

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;
  const deliberes = requete.data ?? [];

  // Au plus un délibéré en attente par étape (Q-78) : une étape qui en porte déjà un ne se remet
  // pas en délibéré — on proroge, on rabat ou on enregistre la décision.
  const etapesEnAttente = new Set(deliberes.filter((d) => d.etat === "EN_ATTENTE").map((d) => d.etapeId));
  const etapesDisponibles = dossier.etapes
    .filter((etape) => etape.statutCycleVie === "EN_DELIBERE" && !etapesEnAttente.has(etape.id))
    .map((etape) => ({ id: etape.id, libelle: libelleEtape(etape.id) }));
  const aucuneEtapeEnDelibere = !dossier.etapes.some((etape) => etape.statutCycleVie === "EN_DELIBERE");

  return (
    <div className="flex flex-col gap-4">
      {peutGerer ? (
        <div className="flex flex-col items-start gap-2">
          <Button onClick={() => setMiseEnDelibere(true)} disabled={etapesDisponibles.length === 0}>
            <Gavel size={15} aria-hidden />
            {t("mettreEnDelibere")}
          </Button>
          {aucuneEtapeEnDelibere ? (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneEtapeEnDelibere")}</p>
          ) : null}
        </div>
      ) : null}

      {deliberes.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("aucun")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {deliberes.map((delibere) => (
            <CarteDelibere
              key={delibere.id}
              dossierId={dossier.id}
              delibere={delibere}
              libelleEtape={libelleEtape(delibere.etapeId)}
              actionsPossibles={peutGerer && delibere.etat === "EN_ATTENTE" && etapeEnDelibere(delibere.etapeId)}
              peutGerer={peutGerer}
              onAction={(type) => setAction({ type, delibere })}
              onHistorique={() => setHistorique(delibere)}
            />
          ))}
        </ul>
      )}

      {peutGerer ? (
        <>
          <ModaleMiseEnDelibere
            dossierId={dossier.id}
            etapes={etapesDisponibles}
            ouvert={miseEnDelibere}
            onFermeture={() => setMiseEnDelibere(false)}
          />
          <ModaleVider
            dossierId={dossier.id}
            delibere={action?.type === "vider" ? action.delibere : null}
            onFermeture={() => setAction(null)}
          />
          <ModaleProroger
            dossierId={dossier.id}
            delibere={action?.type === "proroger" ? action.delibere : null}
            onFermeture={() => setAction(null)}
          />
          <ModaleRabattre
            dossierId={dossier.id}
            delibere={action?.type === "rabattre" ? action.delibere : null}
            onFermeture={() => setAction(null)}
          />
        </>
      ) : null}
      <ModaleProrogations delibere={historique} onFermeture={() => setHistorique(null)} />
    </div>
  );
}

function CarteDelibere({
  dossierId,
  delibere,
  libelleEtape,
  actionsPossibles,
  peutGerer,
  onAction,
  onHistorique,
}: {
  dossierId: number;
  delibere: Delibere;
  libelleEtape: string;
  actionsPossibles: boolean;
  peutGerer: boolean;
  onAction: (type: Action) => void;
  onHistorique: () => void;
}) {
  const t = useTranslations("deliberes");
  const tdom = useTranslations("domaine");
  const langue = useLocale() as Langue;
  const expedition = useModifierExpedition(dossierId);

  const date = formaterDate(delibere.dateDeliberee, langue);
  const entete =
    delibere.etat === "EN_ATTENTE"
      ? t("annonceAu", { date })
      : delibere.etat === "VIDE"
        ? t("renduLe", { date })
        : t("rabattuLe", { date: formaterDate(delibere.dateRabattement, langue) });

  async function basculerExpedition() {
    const statut = delibere.statutExpedition === "LEVEE" ? "A_LEVER" : "LEVEE";
    try {
      await expedition.mutateAsync({ delibereId: delibere.id, statut });
      toast.success(t("expeditionMiseAJour"));
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    }
  }

  return (
    <li className="rounded border border-bordure bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[length:var(--taille-xs)] uppercase tracking-[0.06em] text-texte-tertiaire">{libelleEtape}</p>
          <p className="font-medium">{entete}</p>
          <span className="flex flex-wrap gap-1">
            <StatutChip ton={TON_ETAT[delibere.etat]}>{tdom(`EtatDelibere.${delibere.etat}` as never)}</StatutChip>
            {delibere.resultat ? (
              <StatutChip ton={TON_RESULTAT[delibere.resultat]}>
                {tdom(`ResultatDelibere.${delibere.resultat}` as never)}
              </StatutChip>
            ) : null}
          </span>
        </div>
        {actionsPossibles ? (
          <div className="flex flex-wrap gap-2">
            <Button taille="sm" onClick={() => onAction("vider")} aria-label={t("viderAria", { date })}>
              {t("vider")}
            </Button>
            <Button variante="secondaire" taille="sm" onClick={() => onAction("proroger")} aria-label={t("prorogerAria", { date })}>
              {t("proroger")}
            </Button>
            <Button variante="secondaire" taille="sm" onClick={() => onAction("rabattre")} aria-label={t("rabattreAria", { date })}>
              {t("rabattre")}
            </Button>
          </div>
        ) : null}
      </div>

      {delibere.nombreProrogations > 0 ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("prorogeFois", { n: delibere.nombreProrogations })}
          <button
            type="button"
            onClick={onHistorique}
            className="inline-flex items-center gap-1 text-texte underline underline-offset-4"
          >
            <History size={13} aria-hidden />
            {t("voirProrogations")}
          </button>
        </p>
      ) : null}

      {delibere.etat === "RABATTU" && delibere.motifRabattement ? (
        <p className="mt-2 text-[length:var(--taille-sm)]">{t("motif", { motif: delibere.motifRabattement })}</p>
      ) : null}

      {delibere.etat === "VIDE" ? (
        <div className="mt-3 grid gap-4 border-t border-bordure pt-3 sm:grid-cols-2">
          <div className="flex flex-col items-start gap-1.5">
            <p className="text-[length:var(--taille-xs)] text-texte-secondaire">{t("expedition")}</p>
            {delibere.statutExpedition ? (
              <StatutChip ton={delibere.statutExpedition === "LEVEE" ? "succes" : "attention"}>
                {tdom(`StatutExpedition.${delibere.statutExpedition}` as never)}
              </StatutChip>
            ) : null}
            {peutGerer ? (
              <Button variante="secondaire" taille="sm" onClick={() => void basculerExpedition()} disabled={expedition.isPending}>
                {delibere.statutExpedition === "LEVEE" ? t("remettreALever") : t("marquerLevee")}
              </Button>
            ) : null}
          </div>
          {delibere.resultat === "FAVORABLE" ? (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucunRecours")}</p>
          ) : (
            <PanneauRecours delibere={delibere} peutConsulter={peutGerer} />
          )}
        </div>
      ) : null}
    </li>
  );
}

/** Écran 27 — suivi du délai de recours. La lecture (#21) est réservée au juriste. */
function PanneauRecours({ delibere, peutConsulter }: { delibere: Delibere; peutConsulter: boolean }) {
  const t = useTranslations("deliberes");
  const requete = useRecours(delibere.id, peutConsulter);
  const recours = requete.data;
  const situation = !recours
    ? null
    : recours.recoursExerce
      ? t("recoursExerce")
      : recours.cloture
        ? t("recoursCloture")
        : recours.delaiExpire
          ? t("recoursExpire")
          : t("recoursOuvert");

  return (
    <section aria-label={t("recoursTitre")} className="flex flex-col gap-1">
      <p className="text-[length:var(--taille-xs)] text-texte-secondaire">{t("recoursTitre")}</p>
      <p className="text-[length:var(--taille-sm)] font-medium">
        {t("recoursEcheance")} <DateHeureValeur valeur={delibere.dateEcheanceRecours} />
      </p>
      {requete.error ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {messageErreur(requete.error)}
        </p>
      ) : situation ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{situation}</p>
      ) : null}
    </section>
  );
}

/**
 * Résultat et échéance de recours, communs à la mise en délibéré « déjà rendue » et à
 * l'enregistrement de la décision. L'échéance n'apparaît que si le résultat ouvre un recours.
 */
function ChampsResultat({
  prefixe,
  resultat,
  champResultat,
  champEcheance,
  erreurResultat,
  erreurEcheance,
}: {
  prefixe: string;
  resultat: string | undefined;
  champResultat: UseFormRegisterReturn;
  champEcheance: UseFormRegisterReturn;
  erreurResultat?: string;
  erreurEcheance?: string;
}) {
  const t = useTranslations("deliberes");
  const tdom = useTranslations("domaine");
  return (
    <>
      <Champ id={`${prefixe}-resultat`} label={t("champResultat")} obligatoire erreur={erreurResultat}>
        <Select id={`${prefixe}-resultat`} enErreur={!!erreurResultat} {...champResultat}>
          <option value="">{t("choisirResultat")}</option>
          {ResultatDelibere.map((valeur) => (
            <option key={valeur} value={valeur}>
              {tdom(`ResultatDelibere.${valeur}` as never)}
            </option>
          ))}
        </Select>
      </Champ>
      {resultat && resultat !== "FAVORABLE" ? (
        <Champ id={`${prefixe}-echeance`} label={t("champEcheance")} obligatoire erreur={erreurEcheance}>
          <Input id={`${prefixe}-echeance`} type="datetime-local" enErreur={!!erreurEcheance} {...champEcheance} />
          <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("aideEcheance")}</p>
        </Champ>
      ) : null}
    </>
  );
}

function useSchemaResultat() {
  const tm = useTranslations("metier");
  return useMemo(
    () =>
      z
        .object({ resultat: z.string(), dateEcheanceRecours: z.string() })
        .superRefine((valeurs, ctx) => {
          if (!valeurs.resultat) {
            ctx.addIssue({ code: "custom", path: ["resultat"], message: tm("champObligatoire") });
          } else if (valeurs.resultat !== "FAVORABLE" && !valeurs.dateEcheanceRecours) {
            ctx.addIssue({ code: "custom", path: ["dateEcheanceRecours"], message: tm("champObligatoire") });
          }
        }),
    [tm],
  );
}

/** Le résultat et, s'il ouvre un recours, son échéance — jamais d'échéance pour un résultat favorable. */
function corpsResultat(resultat: string, dateEcheanceRecours: string) {
  const valeur = resultat as ResultatDelibere;
  return valeur === "FAVORABLE" ? { resultat: valeur } : { resultat: valeur, dateEcheanceRecours };
}

function BandeauErreur({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
      {message}
    </p>
  ) : null;
}

function ModaleMiseEnDelibere({
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
  const t = useTranslations("deliberes");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const enregistrer = useEnregistrerDelibere(dossierId);
  const etapeParDefaut = etapes[0]?.id;

  const schema = useMemo(
    () =>
      z
        .object({
          etapeId: z.coerce.number().int().positive(tm("champObligatoire")),
          dateDeliberee: z.string().min(1, tm("champObligatoire")),
          dejaRendu: z.boolean(),
          resultat: z.string(),
          dateEcheanceRecours: z.string(),
        })
        .superRefine((valeurs, ctx) => {
          if (!valeurs.dejaRendu) return;
          if (!valeurs.resultat) {
            ctx.addIssue({ code: "custom", path: ["resultat"], message: tm("champObligatoire") });
          } else if (valeurs.resultat !== "FAVORABLE" && !valeurs.dateEcheanceRecours) {
            ctx.addIssue({ code: "custom", path: ["dateEcheanceRecours"], message: tm("champObligatoire") });
          }
        }),
    [tm],
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema) });

  // Réinitialiser à l'ouverture seulement (dépendances primitives — cf. leçon F8).
  useEffect(() => {
    if (ouvert) {
      reset({ etapeId: etapeParDefaut, dateDeliberee: "", dejaRendu: false, resultat: "", dateEcheanceRecours: "" });
    }
  }, [ouvert, etapeParDefaut, reset]);

  const dejaRendu = useWatch({ control, name: "dejaRendu" });
  const resultat = useWatch({ control, name: "resultat" });

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await enregistrer.mutateAsync({
        etapeId: valeurs.etapeId,
        dateDeliberee: valeurs.dateDeliberee,
        ...(valeurs.dejaRendu ? corpsResultat(valeurs.resultat, valeurs.dateEcheanceRecours) : {}),
      });
      toast.success(valeurs.dejaRendu ? t("delibereEnregistre") : t("miseEnDelibereEnregistree"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("mettreEnDelibere")}
      description={t("mettreEnDelibereDescription")}
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
        <BandeauErreur message={errors.root?.message} />
        <Champ id="delibere-etape" label={t("champEtape")} obligatoire erreur={errors.etapeId?.message}>
          <Select id="delibere-etape" enErreur={!!errors.etapeId} {...register("etapeId")}>
            {etapes.map((etape) => (
              <option key={etape.id} value={etape.id}>
                {etape.libelle}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ
          id="delibere-date"
          label={dejaRendu ? t("champDateDecision") : t("champDateAnnoncee")}
          obligatoire
          erreur={errors.dateDeliberee?.message}
        >
          <Input id="delibere-date" type="date" enErreur={!!errors.dateDeliberee} {...register("dateDeliberee")} />
        </Champ>
        <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
          <input type="checkbox" {...register("dejaRendu")} />
          {t("dejaRendu")}
        </label>
        {dejaRendu ? (
          <ChampsResultat
            prefixe="delibere"
            resultat={resultat}
            champResultat={register("resultat")}
            champEcheance={register("dateEcheanceRecours")}
            erreurResultat={errors.resultat?.message}
            erreurEcheance={errors.dateEcheanceRecours?.message}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

function ModaleVider({
  dossierId,
  delibere,
  onFermeture,
}: {
  dossierId: number;
  delibere: Delibere | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("deliberes");
  const tc = useTranslations("commun");
  const vider = useViderDelibere(dossierId);
  const schema = useSchemaResultat();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });

  const delibereId = delibere?.id;
  useEffect(() => {
    if (delibereId !== undefined) reset({ resultat: "", dateEcheanceRecours: "" });
  }, [delibereId, reset]);

  const resultat = useWatch({ control, name: "resultat" });

  const soumettre = handleSubmit(async (valeurs) => {
    if (!delibere) return;
    try {
      await vider.mutateAsync({
        delibereId: delibere.id,
        corps: corpsResultat(valeurs.resultat, valeurs.dateEcheanceRecours),
      });
      toast.success(t("delibereVide"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={delibere !== null}
      onFermeture={onFermeture}
      titre={t("vider")}
      description={t("viderDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={vider.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={vider.isPending}>
            {tc("enregistrer")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        <BandeauErreur message={errors.root?.message} />
        {delibere ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
            <DateValeur valeur={delibere.dateDeliberee} />
          </p>
        ) : null}
        <ChampsResultat
          prefixe="vider"
          resultat={resultat}
          champResultat={register("resultat")}
          champEcheance={register("dateEcheanceRecours")}
          erreurResultat={errors.resultat?.message}
          erreurEcheance={errors.dateEcheanceRecours?.message}
        />
      </form>
    </Dialog>
  );
}

function ModaleProroger({
  dossierId,
  delibere,
  onFermeture,
}: {
  dossierId: number;
  delibere: Delibere | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("deliberes");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const langue = useLocale() as Langue;
  const proroger = useProroger(dossierId);

  const schema = useMemo(
    () =>
      z.object({
        // Comparaison de chaînes `YYYY-MM-DD` : l'ordre lexical est l'ordre chronologique.
        date: z.string().min(1, tm("champObligatoire")).refine((date) => date >= demain(), {
          message: tm("champObligatoire"),
        }),
        motif: z.string(),
      }),
    [tm],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });

  const delibereId = delibere?.id;
  useEffect(() => {
    if (delibereId !== undefined) reset({ date: "", motif: "" });
  }, [delibereId, reset]);

  const soumettre = handleSubmit(async ({ date, motif }) => {
    if (!delibere) return;
    try {
      const prorogation = await proroger.mutateAsync({
        delibereId: delibere.id,
        corps: motif.trim() ? { date, motif: motif.trim() } : { date },
      });
      const nouvelleDate = formaterDate(prorogation.date, langue);
      // Au-delà du seuil : un avertissement, pas une erreur — la prorogation est bien enregistrée.
      if (prorogation.alerte) {
        toast.warning(t("seuilDepasse", { date: nouvelleDate, n: prorogation.compteur }));
      } else {
        toast.success(t("delibereProroge", { date: nouvelleDate }));
      }
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={delibere !== null}
      onFermeture={onFermeture}
      titre={t("prorogerTitre")}
      description={t("prorogerDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={proroger.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={proroger.isPending}>
            {t("proroger")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        <BandeauErreur message={errors.root?.message} />
        <Champ id="prorogation-date" label={t("champNouvelleDate")} obligatoire erreur={errors.date?.message}>
          <Input id="prorogation-date" type="date" min={demain()} enErreur={!!errors.date} {...register("date")} />
        </Champ>
        <Champ id="prorogation-motif" label={t("champMotifFacultatif")}>
          <Input id="prorogation-motif" maxLength={255} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}

function ModaleRabattre({
  dossierId,
  delibere,
  onFermeture,
}: {
  dossierId: number;
  delibere: Delibere | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("deliberes");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const rabattre = useRabattre(dossierId);

  const schema = useMemo(
    () =>
      z.object({
        date: z.string().min(1, tm("champObligatoire")),
        motif: z.string().trim().min(1, tm("champObligatoire")).max(1000),
      }),
    [tm],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });

  const delibereId = delibere?.id;
  useEffect(() => {
    if (delibereId !== undefined) reset({ date: aujourdhui(), motif: "" });
  }, [delibereId, reset]);

  const soumettre = handleSubmit(async ({ date, motif }) => {
    if (!delibere) return;
    try {
      await rabattre.mutateAsync({ delibereId: delibere.id, corps: { date, motif: motif.trim() } });
      toast.success(t("delibereRabattu"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={delibere !== null}
      onFermeture={onFermeture}
      titre={t("rabattreTitre")}
      description={t("rabattreDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={rabattre.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={rabattre.isPending}>
            {t("rabattre")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        <BandeauErreur message={errors.root?.message} />
        <Champ id="rabattement-date" label={t("champDateRabattement")} obligatoire erreur={errors.date?.message}>
          <Input id="rabattement-date" type="date" enErreur={!!errors.date} {...register("date")} />
        </Champ>
        <Champ id="rabattement-motif" label={t("champMotif")} obligatoire erreur={errors.motif?.message}>
          <Textarea id="rabattement-motif" rows={4} maxLength={1000} enErreur={!!errors.motif} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}

/** Historique des prorogations (FR-DEL-04 critère 2), chargé seulement à l'ouverture. */
function ModaleProrogations({ delibere, onFermeture }: { delibere: Delibere | null; onFermeture: () => void }) {
  const t = useTranslations("deliberes");
  const tc = useTranslations("commun");
  const requete = useProrogations(delibere?.id ?? null);
  const prorogations = requete.data ?? [];

  return (
    <Dialog
      ouvert={delibere !== null}
      onFermeture={onFermeture}
      titre={t("voirProrogations")}
      pied={
        <Button variante="secondaire" onClick={onFermeture}>
          {tc("fermer")}
        </Button>
      }
    >
      {requete.isLoading ? (
        <EtatChargement lignes={3} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : prorogations.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("aucuneProrogation")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">{t("colonneNumero")}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t("colonneDate")}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t("colonneMotif")}</th>
                <th scope="col" className="py-2 font-medium">{t("colonneEnregistree")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {prorogations.map((prorogation) => (
                <tr key={prorogation.id}>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-1">
                      {prorogation.compteur}
                      {prorogation.alerte ? <StatutChip ton="attention">{t("auDelaDuSeuil")}</StatutChip> : null}
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-medium">
                    <DateValeur valeur={prorogation.date} />
                  </td>
                  <td className="py-2 pr-3">{prorogation.motif ?? "—"}</td>
                  <td className="py-2">
                    <DateHeureValeur valeur={prorogation.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
