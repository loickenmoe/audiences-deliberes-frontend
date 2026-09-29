"use client";

import { Paperclip } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { Pagination } from "@/components/metier/pagination";
import { Champ, Input } from "@/components/ui/champ";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { TAILLE_PAGE } from "@/hooks/const";
import { useComptesRendusAttendus, useJournalAudiences } from "@/hooks/useAudiences";
import { useLibelles } from "@/hooks/useLibelles";
import type { Langue } from "@/i18n/config";
import { messageErreur } from "@/lib/api/errors";
import { aujourdhui } from "@/lib/calendrier";
import { formaterDate } from "@/lib/utils";

/** Fenêtre par défaut des comptes rendus attendus : un mois en arrière. */
function ilYaUnMois(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Écran 44 — journal des audiences et comptes rendus attendus (observation métier du 2026-09-25).
 *
 * **Deux questions, deux blocs.** Ce qui s'est passé tel jour, et ce qui n'a toujours pas été
 * rapporté. La première se regarde chaque matin, la seconde de loin en loin : les mêler dans un
 * seul tableau aurait obligé à choisir une date pour voir des retards qui n'en dépendent pas.
 *
 * **Les deux comptes rendus sont montrés côte à côte.** Celui du juriste, saisi sur l'audience, et
 * celui de l'avocat, déposé puis validé — avec la pièce qu'il y a jointe, s'il y en a une. Élire
 * l'un des deux aurait fait passer pour un manquement une audience dont l'autre partie a déjà
 * rendu compte.
 *
 * **Les deux tableaux sont paginés**, comme les autres listes du système : une juridiction chargée
 * aligne les audiences, et un mois de retards peut en compter beaucoup. La barre reste affichée même
 * sur une page unique, car c'est elle qui porte le nombre total et le choix du nombre de lignes —
 * savoir qu'on voit « 7 éléments » et non une liste tronquée fait partie de l'information.
 */
export function JournalAudiences() {
  const t = useTranslations("journalAudiences");
  const tdom = useTranslations("domaine");
  const langue = useLocale() as Langue;
  const { nomUtilisateur } = useLibelles();

  const [date, setDate] = useState(aujourdhui());
  const [pageJournal, setPageJournal] = useState(0);
  const [tailleJournal, setTailleJournal] = useState(TAILLE_PAGE);
  const [debut, setDebut] = useState(ilYaUnMois());
  const [fin, setFin] = useState(aujourdhui());
  const [pageAttendus, setPageAttendus] = useState(0);
  const [tailleAttendus, setTailleAttendus] = useState(TAILLE_PAGE);

  const journal = useJournalAudiences(date, pageJournal, tailleJournal);
  const attendus = useComptesRendusAttendus(debut, fin, pageAttendus, tailleAttendus);
  const fenetreInversee = debut > fin;

  /** Changer de date ou de fenêtre ramène à la première page : sinon on reste sur une page vide. */
  function changerDate(valeur: string) {
    setDate(valeur);
    setPageJournal(0);
  }

  function changerFenetre(borne: "debut" | "fin", valeur: string) {
    if (borne === "debut") setDebut(valeur);
    else setFin(valeur);
    setPageAttendus(0);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="titre-journal">
        <h2 id="titre-journal" className="font-semibold">
          {t("journalTitre")}
        </h2>
        <Champ id="journal-date" label={t("champDate")} className="w-56">
          <Input
            id="journal-date"
            type="date"
            max={aujourdhui()}
            value={date}
            onChange={(evenement) => changerDate(evenement.target.value)}
          />
        </Champ>

        {journal.error ? (
          <EtatErreur message={messageErreur(journal.error)} />
        ) : journal.data === undefined ? (
          <EtatChargement lignes={4} />
        ) : journal.data.content.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("journalVide")}</p>
        ) : (
          <>
            <Table aria-label={t("journalTitre")}>
              <Thead>
                <Tr>
                  <Th>{t("colonneDossier")}</Th>
                  <Th>{t("colonneEtape")}</Th>
                  <Th>{t("colonneJuristes")}</Th>
                  <Th>{t("colonneCompteRenduJuriste")}</Th>
                  <Th>{t("colonneCompteRenduAvocat")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {journal.data.content.map((audience) => (
                  <Tr key={audience.audienceId}>
                    <Td>
                      <Link
                        href={`/dossiers/${audience.dossierId}?onglet=audiences`}
                        className="underline underline-offset-2"
                      >
                        {audience.referenceDossier}
                      </Link>
                      {audience.juridiction ? (
                        <span className="block text-[length:var(--taille-xs)] text-texte-tertiaire">
                          {audience.juridiction}
                        </span>
                      ) : null}
                    </Td>
                    <Td>{audience.etape ? tdom(`TypeEtape.${audience.etape}` as never) : "—"}</Td>
                    <Td>{audience.juristesAffectes.map(nomUtilisateur).join(", ") || "—"}</Td>
                    <Td>
                      {audience.compteRenduJuriste ?? <span className="text-danger">{t("manquant")}</span>}
                    </Td>
                    <Td>
                      {audience.compteRenduAvocat ?? (
                        <span className="text-texte-tertiaire">{t("nonDepose")}</span>
                      )}
                      {audience.urlPieceJointeAvocat ? (
                        <a
                          href={audience.urlPieceJointeAvocat}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 flex items-center gap-1 text-[length:var(--taille-xs)] underline underline-offset-2"
                        >
                          <Paperclip size={12} aria-hidden />
                          {t("consulterPiece")}
                        </a>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Pagination
              page={pageJournal}
              totalPages={journal.data.totalPages}
              totalElements={journal.data.totalElements}
              onChangement={setPageJournal}
              taille={tailleJournal}
              onChangementTaille={(nouvelle) => {
                setTailleJournal(nouvelle);
                setPageJournal(0);
              }}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titre-attendus">
        <h2 id="titre-attendus" className="font-semibold">
          {t("attendusTitre")}
        </h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">{t("attendusAide")}</p>

        <div className="flex flex-wrap items-end gap-3">
          <Champ id="attendus-debut" label={t("du")} className="w-48">
            <Input
              id="attendus-debut"
              type="date"
              value={debut}
              onChange={(evenement) => changerFenetre("debut", evenement.target.value)}
            />
          </Champ>
          <Champ id="attendus-fin" label={t("au")} className="w-48">
            <Input
              id="attendus-fin"
              type="date"
              value={fin}
              onChange={(evenement) => changerFenetre("fin", evenement.target.value)}
            />
          </Champ>
        </div>

        {fenetreInversee ? (
          <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
            {t("fenetreInversee")}
          </p>
        ) : attendus.error ? (
          <EtatErreur message={messageErreur(attendus.error)} />
        ) : attendus.data === undefined ? (
          <EtatChargement lignes={3} />
        ) : attendus.data.content.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("attendusVide")}</p>
        ) : (
          <>
            <Table aria-label={t("attendusTitre")}>
              <Thead>
                <Tr>
                  <Th>{t("colonneDate")}</Th>
                  <Th>{t("colonneDossier")}</Th>
                  <Th>{t("colonneEtape")}</Th>
                  <Th>{t("colonneJuristes")}</Th>
                  <Th>{t("colonneRetard")}</Th>
                  <Th>{t("colonneAvocat")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {attendus.data.content.map((attendu) => (
                  <Tr key={attendu.audienceId}>
                    <Td>{formaterDate(attendu.datePlanifiee, langue)}</Td>
                    <Td>
                      <Link
                        href={`/dossiers/${attendu.dossierId}?onglet=audiences`}
                        className="underline underline-offset-2"
                      >
                        {attendu.referenceDossier}
                      </Link>
                    </Td>
                    <Td>{attendu.etape ? tdom(`TypeEtape.${attendu.etape}` as never) : "—"}</Td>
                    <Td>{attendu.juristesAffectes.map(nomUtilisateur).join(", ") || "—"}</Td>
                    <Td>{t("joursDeRetard", { jours: attendu.joursDeRetard })}</Td>
                    <Td>
                      {attendu.compteRenduAvocatDepose ? (
                        <span className="text-texte-secondaire">{t("avocatARendu")}</span>
                      ) : (
                        <span className="text-texte-tertiaire">{t("nonDepose")}</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Pagination
              page={pageAttendus}
              totalPages={attendus.data.totalPages}
              totalElements={attendus.data.totalElements}
              onChangement={setPageAttendus}
              taille={tailleAttendus}
              onChangementTaille={(nouvelle) => {
                setTailleAttendus(nouvelle);
                setPageAttendus(0);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}
