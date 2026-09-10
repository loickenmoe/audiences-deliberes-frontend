"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { MontantFcfa } from "@/components/metier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLibelles } from "@/hooks/useLibelles";
import type { Dossier } from "@/types/domaine";

/** Paire libellé / valeur. Une valeur absente s'affiche « — » plutôt qu'un blanc ambigu. */
function Donnee({ libelle, children }: { libelle: string; children: ReactNode }) {
  const vide = children === null || children === undefined || children === "";
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[length:var(--taille-xs)] text-texte-tertiaire">{libelle}</dt>
      <dd className="text-[length:var(--taille-sm)]">{vide ? "—" : children}</dd>
    </div>
  );
}

/**
 * Onglet synthèse.
 *
 * Les affectations arrivent du backend sous forme d'**identifiants nus** (`juristesAffectes:
 * [3, 7]`) : `useLibelles` les résout en noms. Un juriste jamais connecté n'est pas dans
 * l'annuaire (QF-16) et s'affiche alors `#id` — un blanc laisserait croire à une absence
 * d'affectation.
 */
export function OngletSynthese({ dossier }: { dossier: Dossier }) {
  const t = useTranslations("dossiers");
  const tf = useTranslations("fiche");
  const tdom = useTranslations("domaine");
  const { nomUtilisateur, nomIntervenant } = useLibelles();

  const estRecouvrement = dossier.categorie === "RECOUVREMENT";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("sectionIdentification")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Donnee libelle={t("champJuridiction")}>{dossier.juridictionSaisie}</Donnee>
            <Donnee libelle={t("champRisque")}>
              <MontantFcfa valeur={dossier.risqueEncouru} />
            </Donnee>
            <Donnee libelle={t("champAgenceOrigine")}>{dossier.codeAgenceOrigine}</Donnee>
            <Donnee libelle={t("champAgenceContentieuse")}>{dossier.codeAgenceContentieuse}</Donnee>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionParties")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Donnee libelle={t("champDemandeur")}>{dossier.parties?.demandeur}</Donnee>
            <Donnee libelle={t("champDefendeur")}>{dossier.parties?.defendeur}</Donnee>
            <Donnee libelle={t("champRecours")}>{dossier.recoursExerces}</Donnee>
            <Donnee libelle={t("champMotifRenvoi")}>{dossier.motifRenvoi}</Donnee>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionPieces")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Seule la paire exigée par la catégorie a un sens : l'autre est toujours vide. */}
          <dl className="grid gap-4 sm:grid-cols-2">
            {estRecouvrement ? (
              <>
                <Donnee libelle={t("champDossierCredit")}>{dossier.dossierCreditOrigine}</Donnee>
                <Donnee libelle={t("champPvTransfert")}>{dossier.pvTransfert}</Donnee>
              </>
            ) : (
              <>
                <Donnee libelle={t("champIncidentCompte")}>{dossier.incidentCompteReference}</Donnee>
                <Donnee libelle={t("champElementsJustificatifs")}>
                  {dossier.elementsJustificatifs}
                </Donnee>
              </>
            )}
            <Donnee libelle={t("champAlarme")}>{dossier.champAlarme}</Donnee>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionAffectation")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Donnee libelle={t("champJuristes")}>
              {dossier.juristesAffectes.length > 0 ? (
                <ul className="flex flex-col gap-0.5">
                  {dossier.juristesAffectes.map((id) => (
                    <li key={id}>{nomUtilisateur(id)}</li>
                  ))}
                </ul>
              ) : (
                tf("aucun")
              )}
            </Donnee>
            <Donnee libelle={t("champAvocats")}>
              {dossier.avocatsAffectes.length > 0 ? (
                <ul className="flex flex-col gap-0.5">
                  {dossier.avocatsAffectes.map((id) => (
                    <li key={id}>{nomIntervenant(id)}</li>
                  ))}
                </ul>
              ) : (
                tf("aucun")
              )}
            </Donnee>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t("sectionSensibilite")}</CardTitle>
        </CardHeader>
        <CardContent>
          {dossier.estSensible ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Donnee libelle={tf("statutSensibilite")}>
                {dossier.sensibiliteStatut
                  ? tdom(`StatutValidation.${dossier.sensibiliteStatut}` as never)
                  : null}
              </Donnee>
              <Donnee libelle={tf("seuilApplique")}>
                <MontantFcfa valeur={dossier.seuilMontant} />
              </Donnee>
              <Donnee libelle={tf("origineSeuil")}>
                {dossier.seuilOrigine ? tdom(`SeuilOrigine.${dossier.seuilOrigine}` as never) : null}
              </Donnee>
              <Donnee libelle={t("champTypeClientSensible")}>{dossier.typeClientSensible}</Donnee>
              {dossier.sensibiliteStatut === "REJETEE" ? (
                <Donnee libelle={tf("motifRejet")}>{dossier.sensibiliteMotifRejet}</Donnee>
              ) : null}
            </dl>
          ) : (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{tf("nonSensible")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
