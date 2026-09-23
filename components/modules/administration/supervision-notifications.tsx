"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { useRelancerNotification, useSupervisionNotifications } from "@/hooks/useNotifications";
import { messageErreur } from "@/lib/api/errors";
import { fenetreParDefaut, tauxAboutissement } from "@/lib/notifications";
import type { LigneCanalNotification } from "@/types/domaine";

/**
 * Supervision des notifications externes (backend D17), sous celle du canal applicatif.
 *
 * **Pourquoi six colonnes et non un taux unique.** Une notification externe traverse des états que
 * rien ne permet de confondre : en file, remise au moteur, confirmée par lui, abandonnée, restée
 * sans réponse, ou sans destinataire joignable. Les réunir donnerait un chiffre rassurant et faux —
 * « remise » ne veut pas dire « reçue », et c'est justement l'écart que cet écran doit montrer.
 *
 * **« Sans retour » est l'état le plus instructif.** Le moteur rejette sans rien dire un message mal
 * signé : ni accusé de succès, ni accusé d'échec. Une colonne qui se remplit là signale une
 * configuration en défaut, pas un incident de réseau.
 *
 * **Les lignes sans coordonnée sortent du taux** : elles parlent d'une fiche à compléter, pas d'un
 * canal en panne.
 */
export function SupervisionNotifications() {
  const t = useTranslations("supervisionNotifications");
  const defaut = fenetreParDefaut();
  const [debut, setDebut] = useState(defaut.debut);
  const [fin, setFin] = useState(defaut.fin);
  const fenetreInversee = Boolean(debut && fin && debut > fin);
  const requete = useSupervisionNotifications(debut, fin, !fenetreInversee);
  const relancer = useRelancerNotification();

  const lancerLaRelance = (id: number) =>
    relancer.mutate(id, {
      onSuccess: () => toast.success(t("relanceFaite")),
      onError: (erreur) => toast.error(messageErreur(erreur)),
    });

  return (
    <section className="flex flex-col gap-4 rounded border border-bordure bg-surface p-5" aria-labelledby="titre-supervision-notifications">
      <header className="flex flex-col gap-1">
        <h2 id="titre-supervision-notifications" className="text-[length:var(--taille-lg)] font-semibold tracking-tight">
          {t("titre")}
        </h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">{t("description")}</p>
        {requete.data && !requete.data.engineActif ? (
          <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-tertiaire">{t("moteurCoupe")}</p>
        ) : null}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Champ id="supervision-notifications-debut" label={t("dateDebut")} className="max-w-[12rem]">
          <Input
            id="supervision-notifications-debut"
            type="date"
            value={debut}
            onChange={(evenement) => setDebut(evenement.target.value)}
          />
        </Champ>
        <Champ
          id="supervision-notifications-fin"
          label={t("dateFin")}
          className="max-w-[12rem]"
          erreur={fenetreInversee ? t("fenetreInversee") : undefined}
        >
          <Input
            id="supervision-notifications-fin"
            type="date"
            value={fin}
            onChange={(evenement) => setFin(evenement.target.value)}
          />
        </Champ>
      </div>

      {requete.isLoading ? <EtatChargement lignes={4} /> : null}
      {requete.error ? <EtatErreur message={messageErreur(requete.error)} /> : null}

      {requete.data ? (
        <>
          <TableWrapper>
            <Table aria-label={t("tableauCanaux")}>
              <Thead>
                <Tr>
                  <Th>{t("canal")}</Th>
                  <Th className="text-right">{t("enAttente")}</Th>
                  <Th className="text-right">{t("remises")}</Th>
                  <Th className="text-right">{t("confirmees")}</Th>
                  <Th className="text-right">{t("echecs")}</Th>
                  <Th className="text-right">{t("sansRetour")}</Th>
                  <Th className="text-right">{t("nonJoignables")}</Th>
                  <Th className="text-right">{t("taux")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {requete.data.canaux.map((ligne) => (
                  <LigneCanal key={ligne.canal} ligne={ligne} />
                ))}
              </Tbody>
            </Table>
          </TableWrapper>

          <h3 className="font-medium">{t("aExaminer")}</h3>
          {requete.data.derniersEchecs.length === 0 ? (
            <EtatVide titre={t("aucunEchec")} description={t("aucunEchecTexte")} />
          ) : (
            <TableWrapper>
              <Table aria-label={t("aExaminer")}>
                <Thead>
                  <Tr>
                    <Th>{t("evenement")}</Th>
                    <Th>{t("canal")}</Th>
                    <Th>{t("statut")}</Th>
                    <Th>{t("destinataire")}</Th>
                    <Th>{t("cause")}</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {requete.data.derniersEchecs.map((envoi) => (
                    <Tr key={envoi.id}>
                      <Td>
                        <span className="font-medium">{t(`evenements.${envoi.typeEvenement}` as never)}</span>
                        <span className="block font-mono text-[length:var(--taille-2xs)] text-texte-tertiaire">
                          {envoi.eventId}
                        </span>
                      </Td>
                      <Td>{t(`canaux.${envoi.canal}` as never)}</Td>
                      <Td>{t(`statuts.${envoi.statut}` as never)}</Td>
                      <Td>
                        {envoi.destinataire ?? t("sansDestinataire")}
                        {/* Hors production, le message part vers une adresse de test : on montre les deux. */}
                        {envoi.destinataireOrigine ? (
                          <span className="block text-[length:var(--taille-2xs)] text-texte-tertiaire">
                            {t("destinataireReel", { destinataire: envoi.destinataireOrigine })}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="max-w-[20rem] break-words text-texte-secondaire">{envoi.derniereErreur ?? "—"}</Td>
                      <Td className="text-right">
                        <Button
                          variante="secondaire"
                          taille="sm"
                          disabled={relancer.isPending || envoi.destinataire === null}
                          onClick={() => lancerLaRelance(envoi.id)}
                        >
                          {t("relancer")}
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrapper>
          )}
        </>
      ) : null}
    </section>
  );
}

function LigneCanal({ ligne }: { ligne: LigneCanalNotification }) {
  const t = useTranslations("supervisionNotifications");
  const taux = tauxAboutissement(ligne);
  return (
    <Tr>
      <Td className="font-medium">{t(`canaux.${ligne.canal}` as never)}</Td>
      <Td className="text-right">{ligne.enAttente}</Td>
      <Td className="text-right">{ligne.remises}</Td>
      <Td className="text-right">{ligne.confirmees}</Td>
      <Td className="text-right">{ligne.echecs}</Td>
      <Td className="text-right">{ligne.sansRetour}</Td>
      <Td className="text-right">{ligne.nonJoignables}</Td>
      <Td className="text-right tabular-nums">{taux === null ? "—" : `${taux} %`}</Td>
    </Tr>
  );
}
