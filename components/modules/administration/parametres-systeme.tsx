"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { PoidsFichier } from "@/components/metier";
import { GrilleNotifications } from "@/components/modules/administration/grille-notifications";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useConfigurations, useModifierConfiguration } from "@/hooks/useConfigurations";
import { useLibelles } from "@/hooks/useLibelles";
import {
  basculerElement,
  verifierValeurConfiguration,
  type MotifRefusConfiguration,
} from "@/lib/alertes";
import { messageErreur } from "@/lib/api/errors";
import { CLES_CANAUX, estCleDeGrille } from "@/lib/notifications";
import type { ConfigurationSysteme } from "@/types/domaine";

/**
 * Screen 41 - system settings (CONF01-07).
 * The form is driven by the contract: each key declares whether it expects a bounded integer or a
 * closed list, and the screen derives the input, displayed bounds and validation. A key added on
 * the backend shows up with the right input without changing this file.
 * Values are saved one by one, never in bulk: each takes effect immediately, and a bulk save would
 * hide which one failed.
 */
export function ParametresSysteme({ modifiable }: Readonly<{ modifiable: boolean }>) {
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
  // Notification grid columns are read together, in their own table.
  const parametres = configurations.filter((configuration) => !estCleDeGrille(configuration.cle));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        {modifiable ? null : (
          <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-tertiaire">
            {t("lectureSeule")}
          </p>
        )}
      </header>

      {parametres.length === 0 ? (
        <EtatVide titre={t("vide")} description={t("videTexte")} />
      ) : (
        <ul className="flex flex-col gap-4">
          {parametres.map((configuration) => (
            <li key={configuration.cle}>
              <LigneParametre configuration={configuration} modifiable={modifiable} />
            </li>
          ))}
        </ul>
      )}

      <GrilleNotifications configurations={configurations} modifiable={modifiable} />
    </div>
  );
}

function LigneParametre({
  configuration,
  modifiable,
}: Readonly<{
  configuration: ConfigurationSysteme;
  modifiable: boolean;
}>) {
  const t = useTranslations("configurations");
  const tr = useTranslations("referentiels");
  const td = useTranslations("domaine");
  const { nomUtilisateur } = useLibelles();
  const modifier = useModifierConfiguration();
  const [valeur, setValeur] = useState(configuration.valeur);

  const refus = verifierValeurConfiguration(configuration, valeur);
  const modifie = valeur.trim() !== configuration.valeur;
  const identifiant = `configuration-${configuration.cle}`;
  const elements = valeur.split(",").map((item) => item.trim().toUpperCase());
  // Channels are displayed by name ("Personal email"); other lists by code.
  const enumCanaux = CLES_CANAUX[configuration.cle];
  const libelleValeur = (code: string) => (enumCanaux ? td(`${enumCanaux}.${code}` as never) : code);

  // The business description is translated; the backend one is the fallback for an unknown key.
  const messages = tr.raw("configurations") as Record<string, string | undefined>;
  const description = messages[configuration.cle] ?? configuration.description ?? "";

  /**
   * Only the "bounds" message is parameterized: grouping it with the others in a `t(cle as never)`
   * would lose the typing of the message variables.
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
                {libelleValeur(possible)}
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
          {/*
            "Modified on ... by ...": answers who changed a setting and when, directly on its row.
            The full system action log lives on the audit screen.
          */}
          <span>
            {configuration.dateModification
              ? configuration.dernierAuteurId === null
                ? t("modifiee", { date: new Date(configuration.dateModification).toLocaleDateString() })
                : t("modifieeParAuteur", {
                    date: new Date(configuration.dateModification).toLocaleDateString(),
                    auteur: nomUtilisateur(configuration.dernierAuteurId),
                  })
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
