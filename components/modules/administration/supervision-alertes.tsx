"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useStatistiquesDiffusion } from "@/hooks/useAlertes";
import { messageErreur } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

/** Bornes par défaut : les trente derniers jours, bornes incluses, au format ISO attendu. */
function fenetreParDefaut(): { debut: string; fin: string } {
  const aujourdHui = new Date();
  const ilYATrenteJours = new Date(aujourdHui.getTime() - 29 * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { debut: iso(ilYATrenteJours), fin: iso(aujourdHui) };
}

/**
 * Supervision du canal applicatif (backend Q-109, NF-ALR-02).
 *
 * **Le défaut qu'elle corrige.** NF-ALR-02 fait du canal applicatif le canal obligatoire, avec une
 * délivrance supérieure à 99 %. Ce taux n'était mesuré nulle part : un échec de diffusion ne
 * produisait qu'une ligne de journal, que personne ne lit. C'était la seule exigence non
 * fonctionnelle dont la rupture était **silencieuse pour tout le monde** — y compris pour le
 * juriste qui découvrait après coup l'audience qu'on ne lui avait pas rappelée.
 *
 * **Deux taux, affichés séparément, et c'est le cœur de l'écran.** Les réunir en un seul chiffre
 * rassurant aurait vidé la mesure de son sens :
 *
 * - **Délivrance** — le canal a-t-il fait son travail ? Seuls les échecs comptent contre nous. Une
 *   alerte remise plus tard, parce que son destinataire n'était pas connecté, a bien été délivrée :
 *   le canal applicatif comprend la liste des notifications, alimentée inconditionnellement.
 *   C'est **ce taux** que NF-ALR-02 borne à 99 %.
 * - **Diffusion temps réel** — à quel point les gens sont-ils connectés quand on les alerte ? Un
 *   chiffre bas n'est **pas** un défaut du système ; c'est une information sur les usages, et
 *   souvent la raison de brancher enfin un second canal. Aucun seuil ne lui est opposé.
 *
 * L'écran le dit explicitement plutôt que de laisser deviner : un tableau de bord qu'on interprète
 * de travers est pire qu'un tableau de bord absent.
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
        La fenêtre inversée est arrêtée ici plutôt que laissée partir : le backend la refuse (400),
        mais l'utilisateur lirait alors un message d'erreur technique là où il a simplement inversé
        deux dates.
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
            // Une fenêtre vide n'est ni conforme ni fautive : afficher « 0 % » laisserait croire à
            // une panne totale, alors qu'aucune alerte n'a simplement été déclenchée.
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
