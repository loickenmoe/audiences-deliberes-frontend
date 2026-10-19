"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useStatistiquesDiffusion } from "@/hooks/useAlertes";
import { messageErreur } from "@/lib/api/errors";
import { fenetreParDefaut } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/**
 * In-app channel monitoring (NF-ALR-02).
 * Two rates are shown separately on purpose:
 * - Delivery: did the channel do its job? Only failures count. An alert delivered later because the
 *   recipient was offline is still delivered (the notification list is always fed). NF-ALR-02 sets
 *   this rate above 99%.
 * - Real-time broadcast: how many people were connected when alerted. A low value is usage
 *   information, not a system defect; no threshold applies.
 */
export function SupervisionAlertes() {
  const t = useTranslations("supervisionAlertes");
  const defaut = fenetreParDefaut();
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const requete = useStatistiquesDiffusion(debut, fin);

  const stats = requete.data;
  const fenetreInversee = Boolean(debut && fin && debut > fin);

  return (
    <section className="flex flex-col gap-4 rounded border border-bordure bg-surface p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--taille-lg)] font-semibold tracking-tight">{t("titre")}</h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("description")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Champ id="supervision-debut" label={t("du")}>
          <Input
            id="supervision-debut"
            type="date"
            value={debut}
            enErreur={fenetreInversee}
            onChange={(evenement) => setDebut(evenement.target.value)}
          />
        </Champ>
        <Champ id="supervision-fin" label={t("au")}>
          <Input
            id="supervision-fin"
            type="date"
            value={fin}
            enErreur={fenetreInversee}
            onChange={(evenement) => setFin(evenement.target.value)}
          />
        </Champ>
        <Button
          variante="secondaire"
          onClick={() => void requete.refetch()}
          disabled={fenetreInversee || requete.isFetching}
        >
          {t("actualiser")}
        </Button>
      </div>

      {/*
        An inverted window is stopped here: the backend rejects it (400), but the user would see a
        technical error for simply swapping two dates.
      */}
      {fenetreInversee ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {t("fenetreInversee")}
        </p>
      ) : requete.isLoading ? (
        <EtatChargement lignes={3} />
      ) : requete.error ? (
        <EtatErreur
          message={messageErreur(requete.error)}
          action={
            <Button variante="secondaire" onClick={() => void requete.refetch()}>
              {t("actualiser")}
            </Button>
          }
        />
      ) : stats ? (
        <div className="flex flex-col gap-4">
          {stats.observees === 0 ? (
            // An empty window is neither compliant nor failing: showing "0%" would suggest a total
            // outage when no alert was triggered.
            <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("aucuneMesure")}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Taux
                  libelle={t("tauxDelivrance")}
                  aide={t("tauxDelivranceAide")}
                  valeur={stats.tauxDelivrance}
                  etat={stats.seuilRespecte ? "conforme" : "alerte"}
                  mention={
                    stats.seuilRespecte ? t("seuilRespecte") : t("seuilFranchi")
                  }
                />
                <Taux
                  libelle={t("tauxTempsReel")}
                  aide={t("tauxTempsReelAide")}
                  valeur={stats.tauxDiffusionTempsReel}
                  etat="neutre"
                  mention={t("sansSeuil")}
                />
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[length:var(--taille-sm)] sm:grid-cols-4">
                <Compte libelle={t("observees")} valeur={stats.observees} />
                <Compte libelle={t("diffusees")} valeur={stats.diffusees} />
                <Compte libelle={t("differees")} valeur={stats.differees} />
                <Compte libelle={t("echecs")} valeur={stats.echecs} accentue={stats.echecs > 0} />
              </dl>

              <p className="text-[length:var(--taille-sm)] text-texte-secondaire">
                {t("nonTraitees", { nombre: stats.nonTraitees })}
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Taux({
  libelle,
  aide,
  valeur,
  etat,
  mention,
}: {
  libelle: string;
  aide: string;
  valeur: number;
  etat: "conforme" | "alerte" | "neutre";
  mention: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-bordure bg-surface-attenuee p-4">
      <p className="text-[length:var(--taille-sm)] font-medium">{libelle}</p>
      <p
        className={cn(
          "text-[length:var(--taille-2xl)] font-semibold tabular-nums",
          etat === "alerte" ? "text-danger" : etat === "conforme" ? "text-succes" : "text-texte",
        )}
      >
        {valeur.toFixed(2)} %
      </p>
      <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{mention}</p>
      <p className="text-[length:var(--taille-xs)] text-texte-secondaire">{aide}</p>
    </div>
  );
}

function Compte({
  libelle,
  valeur,
  accentue = false,
}: {
  libelle: string;
  valeur: number;
  accentue?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[length:var(--taille-xs)] uppercase tracking-wide text-texte-tertiaire">
        {libelle}
      </dt>
      <dd className={cn("font-semibold tabular-nums", accentue ? "text-danger" : undefined)}>
        {valeur}
      </dd>
    </div>
  );
}
