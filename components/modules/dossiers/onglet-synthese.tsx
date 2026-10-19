"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { MontantFcfa } from "@/components/metier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLibelles } from "@/hooks/useLibelles";
import type { Dossier } from "@/types/domaine";

/** Label / value pair. A missing value is shown as "—" rather than an ambiguous blank. */
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
 * Summary tab.
 * Assignments come from the backend as bare ids (`juristesAffectes: [3, 7]`): `useLibelles`
 * resolves them to names. A lawyer who never logged in is not in the directory and is shown as
 * `#id`; a blank would suggest no assignment.
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
            {/*
              Several parties per side, separated by a semicolon rather than a comma since company
              names often contain commas.
            */}
            <Donnee libelle={t("champDemandeurs")}>
              {dossier.parties?.demandeurs?.join(" ; ")}
            </Donnee>
            <Donnee libelle={t("champDefendeurs")}>
              {dossier.parties?.defendeurs?.join(" ; ")}
            </Donnee>
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
          {/* Only the pair required by the category is meaningful: the other is always empty. */}
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
            {/*
              Shown only when it has a value: the field is no longer editable and only remains for
              possible legacy data, under a label that no longer promises a trigger.
            */}
            {dossier.champAlarme ? (
              <Donnee libelle={t("champAlarmeHerite")}>{dossier.champAlarme}</Donnee>
            ) : null}
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
          ) : dossier.sensibiliteMotifRetrait ? (
            /*
             * A case whose due diligence was **removed** is no longer sensitive: without this case
             * the block would only say "ordinary case" and the removal reason, required from the
             * DJ, would be shown nowhere.
             */
            <dl className="grid gap-4 sm:grid-cols-3">
              <Donnee libelle={tf("statutSensibilite")}>{tf("sensibiliteMotifRetrait")}</Donnee>
              <Donnee libelle={tf("diligenceMotifRetrait")}>{dossier.sensibiliteMotifRetrait}</Donnee>
              <Donnee libelle={tf("origineSeuil")}>
                {dossier.seuilOrigine ? tdom(`SeuilOrigine.${dossier.seuilOrigine}` as never) : null}
              </Donnee>
            </dl>
          ) : (
            <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{tf("nonSensible")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
