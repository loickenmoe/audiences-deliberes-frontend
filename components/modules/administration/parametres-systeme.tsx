"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { PoidsFichier } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useConfigurations, useModifierConfiguration } from "@/hooks/useConfigurations";
import {
  basculerElement,
  verifierValeurConfiguration,
  type MotifRefusConfiguration,
} from "@/lib/alertes";
import { messageErreur } from "@/lib/api/errors";
import type { ConfigurationSysteme } from "@/types/domaine";

/**
 * Écran 41 — paramètres système (CONF01-07).
 *
 * Le formulaire se **règle sur le contrat** : chaque clé annonce si elle attend un entier borné ou
 * une liste fermée (backend Q-91), et l'écran en déduit le champ de saisie, les bornes affichées et
 * le contrôle immédiat. Rien n'est redéclaré ici — une clé ajoutée côté backend apparaît avec le
 * bon champ sans toucher à ce fichier.
 *
 * Les valeurs partent une par une, jamais en bloc : chacune prend effet immédiatement pour tous les
 * modules qui la relisent, et un enregistrement groupé masquerait laquelle a échoué.
 */
export function ParametresSysteme({ modifiable }: { modifiable: boolean }) {
  const t = useTranslations("configurations");
  const requete = useConfigurations();

  if (requete.isLoading) return <EtatChargement lignes={7} />;
  if (requete.error) {
    return (
      <EtatErreur
        message={messageErreur(requete.error)}
        action={
          <Button variante="secondaire" onClick={() => void requete.refetch()}>
            {t("enregistrer")}
          </Button>
        }
      />
    );
  }

  const configurations = requete.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        {!modifiable ? (
          <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-tertiaire">
            {t("lectureSeule")}
          </p>
        ) : null}
      </header>

      {configurations.length === 0 ? (
        <EtatVide titre={t("vide")} description={t("videTexte")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {configurations.map((configuration) => (
            <li key={configuration.cle}>
              <LigneParametre configuration={configuration} modifiable={modifiable} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LigneParametre({
  configuration,
  modifiable,
}: {
  configuration: ConfigurationSysteme;
  modifiable: boolean;
}) {
  const t = useTranslations("configurations");
  const tr = useTranslations("referentiels");
  const modifier = useModifierConfiguration();
  const [valeur, setValeur] = useState(configuration.valeur);

  const refus = verifierValeurConfiguration(configuration, valeur);
  const modifie = valeur.trim() !== configuration.valeur;
  const identifiant = `configuration-${configuration.cle}`;
  const elements = valeur.split(",").map((item) => item.trim().toUpperCase());

  // La description métier est traduite ; celle du backend reste le repli pour une clé inconnue.
  const messages = tr.raw("configurations") as Record<string, string | undefined>;
  const description = messages[configuration.cle] ?? configuration.description ?? "";

  /**
   * Seul le motif « bornes » est paramétré : le regrouper avec les autres dans un `t(cle as never)`
   * ferait perdre le typage des variables du message.
   */
  const messageRefus = (motif: MotifRefusConfiguration) =>
    motif === "bornes"
      ? t("refus.bornes", {
          min: configuration.valeurMinimale ?? 0,
          max: configuration.valeurMaximale ?? 0,
        })
      : t(`refus.${motif}` as never);

  const enregistrer = () => {
    modifier.mutate(
      { cle: configuration.cle, valeur: valeur.trim() },
      {
        onSuccess: (mise) => {
          setValeur(mise.valeur);
          toast.success(t("succes", { cle: configuration.cle }));
        },
        onError: (erreur) => toast.error(messageErreur(erreur)),
      },
    );
  };

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-bordure bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-[length:var(--taille-sm)] font-semibold">{configuration.cle}</h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {description}
        </p>
      </div>

      {configuration.typeValeur === "LISTE" ? (
        <fieldset className="flex flex-col gap-2" disabled={!modifiable || modifier.isPending}>
          <legend className="text-[length:var(--taille-sm)] font-medium">
            {t("valeursAcceptees")}
          </legend>
          <div className="flex flex-wrap gap-3">
            {configuration.valeursPossibles.map((possible) => (
              <label key={possible} className="flex items-center gap-2 text-[length:var(--taille-sm)]">
                <input
                  type="checkbox"
                  name={configuration.cle}
                  value={possible}
                  checked={elements.includes(possible)}
                  onChange={() =>
                    setValeur(basculerElement(valeur, possible, configuration.valeursPossibles))
                  }
                  className="size-4 accent-[color:var(--afb-anthracite)]"
                />
                {possible}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <Champ
          id={identifiant}
          label={t("valeur")}
          aide={
            configuration.valeurMinimale !== null && configuration.valeurMaximale !== null
              ? t("bornes", { min: configuration.valeurMinimale, max: configuration.valeurMaximale })
              : undefined
          }
          erreur={refus ? messageRefus(refus) : undefined}
          className="max-w-sm"
        >
          <Input
            id={identifiant}
            name={configuration.cle}
            inputMode={configuration.typeValeur === "ENTIER" ? "numeric" : "text"}
            value={valeur}
            disabled={!modifiable || modifier.isPending}
            onChange={(evenement) => setValeur(evenement.target.value)}
          />
        </Champ>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-[length:var(--taille-xs)] text-texte-tertiaire">
          {configuration.typeValeur === "ENTIER" && configuration.cle === "TAILLE_MAX_GED" ? (
            <PoidsFichier valeur={Number(configuration.valeur)} />
          ) : null}
          <span>
            {configuration.dateModification
              ? t("modifiee", { date: new Date(configuration.dateModification).toLocaleDateString() })
              : t("jamaisModifiee")}
          </span>
        </p>

        {modifiable ? (
          <div className="flex items-center gap-2">
            {modifie ? (
              <Button variante="discrete" taille="sm" onClick={() => setValeur(configuration.valeur)}>
                {t("annuler")}
              </Button>
            ) : null}
            <Button
              taille="sm"
              disabled={!modifie || refus !== null || modifier.isPending}
              onClick={enregistrer}
            >
              {t("enregistrer")}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
