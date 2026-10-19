"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CycleEtape, DialogueConfirmation } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Champ, Select } from "@/components/ui/champ";
import { useCreerEtape, useModifierStatutEtape } from "@/hooks/useDossiers";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import {
  estExerciceDeRecours,
  etapesCreables,
  etapesIntermediairesCreees,
  transitionsPermises,
} from "@/lib/transitions";
import type { Dossier, EtapeProcedure } from "@/types/domaine";
import { TypeEtape, type StatutCycleVie } from "@/types/enums";

/**
 * Screen 08 - procedure steps.
 * Two UI choices follow directly from the backend rules:
 * · only transitions it accepts are offered (`lib/transitions.ts`), rather than the six statuses of
 *   which four would lead to `ERR-004`;
 * · the backend's two silent side effects (automatic opening of the next step on an appeal,
 *   creation of intermediate steps on a direct positioning) are **announced before** confirmation.
 */
export function OngletEtapes({ dossier, roles }: { dossier: Dossier; roles: readonly string[] }) {
  const t = useTranslations("fiche");
  const tdom = useTranslations("domaine");
  const peutGerer = peut(roles, "gererEtapes");

  // Sorted in procedure order: the backend sorts by type, which is not relied upon.
  const etapes = [...dossier.etapes].sort(
    (a, b) => TypeEtape.indexOf(a.type) - TypeEtape.indexOf(b.type),
  );

  return (
    <div className="flex flex-col gap-5">
      {!peutGerer ? (
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("lectureSeuleEtapes")}</p>
      ) : null}

      {etapes.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("etapesAucune")}</p>
      ) : (
        etapes.map((etape) => (
          <Card key={etape.id}>
            <CardHeader>
              <CardTitle>{tdom(`TypeEtape.${etape.type}` as never)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CycleEtape statut={etape.statutCycleVie} />
              {peutGerer ? <ChangementStatut dossierId={dossier.id} etape={etape} /> : null}
            </CardContent>
          </Card>
        ))
      )}

      {peutGerer ? (
        <Positionnement dossierId={dossier.id} existantes={etapes.map((etape) => etape.type)} />
      ) : null}
    </div>
  );
}

function ChangementStatut({ dossierId, etape }: { dossierId: number; etape: EtapeProcedure }) {
  const t = useTranslations("fiche");
  const tdom = useTranslations("domaine");
  const modifier = useModifierStatutEtape(dossierId);
  const [cible, setCible] = useState<StatutCycleVie | "">("");
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const permises = transitionsPermises(etape.statutCycleVie);
  const idChamp = `transition-${etape.id}`;

  async function appliquer(statut: StatutCycleVie) {
    setErreur(null);
    try {
      await modifier.mutateAsync({ etapeId: etape.id, nouveauStatut: statut });
      setCible("");
      setConfirmation(false);
    } catch (e) {
      // `ERR-004` carries a precise message naming the rejected transition: shown as is, next to
      // the related control.
      setErreur(messageErreur(e));
      setConfirmation(false);
    }
  }

  function demander() {
    if (!cible) return;
    if (estExerciceDeRecours(etape.statutCycleVie, cible)) {
      setConfirmation(true);
      return;
    }
    void appliquer(cible);
  }

  if (permises.length === 0) {
    return (
      <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">
        {etape.statutCycleVie === "EN_DELIBERE" ? t("aideEnDelibere") : t("aucuneTransition")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <Champ id={idChamp} label={t("changerStatut")} className="w-60">
          <Select
            id={idChamp}
            value={cible}
            onChange={(evenement) => setCible(evenement.target.value as StatutCycleVie | "")}
          >
            <option value="">{t("choisirStatut")}</option>
            {permises.map((statut) => (
              <option key={statut} value={statut}>
                {tdom(`StatutCycleVie.${statut}` as never)}
              </option>
            ))}
          </Select>
        </Champ>
        <Button onClick={demander} disabled={!cible || modifier.isPending}>
          {t("appliquer")}
        </Button>
      </div>

      {erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {erreur}
        </p>
      ) : null}

      <DialogueConfirmation
        ouvert={confirmation}
        onFermeture={() => setConfirmation(false)}
        onConfirmation={() => void appliquer("EN_COURS")}
        titre={t("confirmerRecoursTitre")}
        message={t("confirmerRecoursMessage", { etape: tdom(`TypeEtape.${etape.type}` as never) })}
        enCours={modifier.isPending}
      />
    </div>
  );
}

function Positionnement({
  dossierId,
  existantes,
}: {
  dossierId: number;
  existantes: readonly TypeEtape[];
}) {
  const t = useTranslations("fiche");
  const tdom = useTranslations("domaine");
  const creer = useCreerEtape(dossierId);
  const [type, setType] = useState<TypeEtape | "">("");
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const creables = etapesCreables(existantes);
  const intermediaires = type ? etapesIntermediairesCreees(type, existantes) : [];

  async function positionner() {
    if (!type) return;
    setErreur(null);
    try {
      await creer.mutateAsync(type);
      setType("");
      setConfirmation(false);
    } catch (e) {
      setErreur(messageErreur(e));
      setConfirmation(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("positionnerTitre")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("positionnerAide")}</p>

        {creables.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("toutesEtapesCreees")}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <Champ id="positionnement" label={t("choisirEtape")} className="w-60">
              <Select
                id="positionnement"
                value={type}
                onChange={(evenement) => setType(evenement.target.value as TypeEtape | "")}
              >
                <option value="">{t("choisirEtape")}</option>
                {creables.map((valeur) => (
                  <option key={valeur} value={valeur}>
                    {tdom(`TypeEtape.${valeur}` as never)}
                  </option>
                ))}
              </Select>
            </Champ>
            <Button
              variante="secondaire"
              disabled={!type || creer.isPending}
              onClick={() => (intermediaires.length > 0 ? setConfirmation(true) : void positionner())}
            >
              {t("positionner")}
            </Button>
          </div>
        )}

        {erreur ? (
          <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
            {erreur}
          </p>
        ) : null}

        <DialogueConfirmation
          ouvert={confirmation}
          onFermeture={() => setConfirmation(false)}
          onConfirmation={() => void positionner()}
          titre={t("confirmerPositionnementTitre")}
          message={t("confirmerPositionnementMessage", {
            etape: type ? tdom(`TypeEtape.${type}` as never) : "",
            intermediaires: intermediaires.map((valeur) => tdom(`TypeEtape.${valeur}` as never)).join(", "),
          })}
          enCours={creer.isPending}
        />
      </CardContent>
    </Card>
  );
}
