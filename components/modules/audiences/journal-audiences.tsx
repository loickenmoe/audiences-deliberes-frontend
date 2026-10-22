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

/** Default window for expected reports: one month back. */
function ilYaUnMois(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Screen 44 - hearing log and expected hearing reports.
 * Two blocks for two questions: what happened on a given day, and what has still not been reported.
 * The lawyer's report (entered on the hearing) and the counsel's report (submitted then validated,
 * with its attachment if any) are shown side by side.
 * Both tables are paginated; the bar stays visible even on a single page since it shows the total
 * count and the page size selector.
 */
export function JournalAudiences() {
  const t = useTranslations("journalAudiences");

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

  /** Changing the date or window returns to the first page, otherwise a page could stay empty. */
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
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("titre")}
        </h1>
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

        <TableauJournal
          erreur={journal.error}
          page={journal.data}
          numeroPage={pageJournal}
          taille={tailleJournal}
          onPage={setPageJournal}
          onTaille={(nouvelle) => {
            setTailleJournal(nouvelle);
            setPageJournal(0);
          }}
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="titre-attendus">
        <h2 id="titre-attendus" className="font-semibold">
          {t("attendusTitre")}
        </h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("attendusAide")}
        </p>

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

        <TableauAttendus
          fenetreInversee={fenetreInversee}
          erreur={attendus.error}
          page={attendus.data}
          numeroPage={pageAttendus}
          taille={tailleAttendus}
          onPage={setPageAttendus}
          onTaille={(nouvelle) => {
            setTailleAttendus(nouvelle);
            setPageAttendus(0);
          }}
        />
      </section>
    </div>
  );
}

type PageJournal = NonNullable<ReturnType<typeof useJournalAudiences>["data"]>;
type PageAttendus = NonNullable<ReturnType<typeof useComptesRendusAttendus>["data"]>;
type Pagine = {
  numeroPage: number;
  taille: number;
  onPage: (page: number) => void;
  onTaille: (taille: number) => void;
};

/** The day's hearings: error, loading, empty, or both reports side by side. */
function TableauJournal({
  erreur,
  page,
  numeroPage,
  taille,
  onPage,
  onTaille,
}: Readonly<{ erreur: unknown; page: PageJournal | undefined } & Pagine>) {
  const t = useTranslations("journalAudiences");
  const tdom = useTranslations("domaine");
  const { nomUtilisateur } = useLibelles();

  if (erreur) return <EtatErreur message={messageErreur(erreur)} />;
  if (page === undefined) return <EtatChargement lignes={4} />;
  if (page.content.length === 0) {
    return (
      <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("journalVide")}</p>
    );
  }
  return (
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
          {page.content.map((audience) => (
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
                {audience.compteRenduJuriste ?? (
                  <span className="text-danger">{t("manquant")}</span>
                )}
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
        page={numeroPage}
        totalPages={page.totalPages}
        totalElements={page.totalElements}
        onChangement={onPage}
        taille={taille}
        onChangementTaille={onTaille}
      />
    </>
  );
}

/** Reports still expected over the window: inverted window, error, loading, empty, or the list. */
function TableauAttendus({
  fenetreInversee,
  erreur,
  page,
  numeroPage,
  taille,
  onPage,
  onTaille,
}: Readonly<
  { fenetreInversee: boolean; erreur: unknown; page: PageAttendus | undefined } & Pagine
>) {
  const t = useTranslations("journalAudiences");
  const tdom = useTranslations("domaine");
  const langue = useLocale() as Langue;
  const { nomUtilisateur } = useLibelles();

  if (fenetreInversee) {
    return (
      <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
        {t("fenetreInversee")}
      </p>
    );
  }
  if (erreur) return <EtatErreur message={messageErreur(erreur)} />;
  if (page === undefined) return <EtatChargement lignes={3} />;
  if (page.content.length === 0) {
    return (
      <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("attendusVide")}</p>
    );
  }
  return (
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
          {page.content.map((attendu) => (
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
        page={numeroPage}
        totalPages={page.totalPages}
        totalElements={page.totalElements}
        onChangement={onPage}
        taille={taille}
        onChangementTaille={onTaille}
      />
    </>
  );
}
