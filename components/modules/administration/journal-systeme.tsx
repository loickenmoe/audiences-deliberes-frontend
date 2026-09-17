"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DateHeureValeur, TableDonnees } from "@/components/metier";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Button } from "@/components/ui/button";
import { TAILLE_PAGE } from "@/hooks/const";
import { useJournalSysteme } from "@/hooks/useJournal";
import { useLibelles } from "@/hooks/useLibelles";
import { useUtilisateurs } from "@/hooks/useReferentiels";
import type { HistoriqueAction } from "@/types/domaine";

/**
 * Rend une valeur de `details`, dont la forme varie d'une action à l'autre. Repris de l'onglet
 * Historique d'un dossier : c'est la même donnée, elle doit se lire de la même façon.
 */
function valeurLisible(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

/**
 * Journal des actions historisées **hors dossier** (backend Q-110).
 *
 * **Le manque qu'il comble.** RG-DOS-06 historise chaque modification, mais l'unique point de
 * lecture — l'onglet Historique — part d'un dossier. Les actions qui n'en ont pas étaient donc
 * écrites et jamais relues : modifications de paramètres système, indexations de jurisprudence.
 * « Qui a abaissé le seuil de validation conjointe ? » exigeait une requête en base. Q-108, en
 * ouvrant l'administration des paramètres à la DJA, a doublé le nombre de détenteurs de ce pouvoir
 * sans rien changer à cette impossibilité — c'est ce qui a rendu la lacune pressante.
 *
 * **Pourquoi il est ici.** Vingt-deux des vingt-six lignes concernées sont des modifications de
 * paramètres. L'adjacence est la bonne : voici les réglages, voici qui les a changés.
 *
 * **Pourquoi « journal » et non « audit ».** Seules les **modifications** sont historisées ; aucune
 * consultation ne l'est. Ouvrir un dossier sensible ou télécharger une pièce ne laisse aucune trace.
 * Un écran intitulé « Audit » promettrait une exhaustivité qu'il n'a pas, et l'absence de ligne s'y
 * lirait comme l'absence d'action. L'écran le dit lui-même, plutôt que de laisser le lecteur le
 * découvrir au moment où il en aurait besoin.
 *
 * **Le filtre par libellé est une liste fermée**, construite à partir des libellés réellement
 * présents en base. `action` est une phrase française libre (QF-24) : une recherche « contient » y
 * paraîtrait commode et mentirait par omission dès qu'un libellé change d'un mot.
 */
export function JournalSysteme() {
  const t = useTranslations("journalSysteme");
  const { nomUtilisateur } = useLibelles();
  const utilisateurs = useUtilisateurs();

  const [auteur, setAuteur] = useState("");
  const [action, setAction] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(TAILLE_PAGE);

  const fenetreInversee = Boolean(debut && fin && debut > fin);

  const requete = useJournalSysteme(
    {
      utilisateurId: auteur ? Number(auteur) : undefined,
      action: action || undefined,
      // Une fenêtre inversée n'est jamais envoyée : le backend la refuse en 400, et l'utilisateur
      // lirait un message technique là où il a simplement inversé deux dates.
      dateDebut: fenetreInversee ? undefined : debut || undefined,
      dateFin: fenetreInversee ? undefined : fin || undefined,
    },
    page,
    taille,
  );

  const colonnes = useMemo(
    () => [
      {
        id: "dateAction",
        header: t("colonneDate"),
        cell: ({ row }: { row: { original: HistoriqueAction } }) => (
          <DateHeureValeur valeur={row.original.dateAction} />
        ),
      },
      {
        id: "utilisateurId",
        header: t("colonneAuteur"),
        cell: ({ row }: { row: { original: HistoriqueAction } }) =>
          row.original.utilisateurId !== null ? nomUtilisateur(row.original.utilisateurId) : "—",
      },
      {
        id: "action",
        header: t("colonneAction"),
        cell: ({ row }: { row: { original: HistoriqueAction } }) => row.original.action,
      },
      {
        id: "details",
        header: t("colonneDetails"),
        cell: ({ row }: { row: { original: HistoriqueAction } }) => {
          const details = row.original.details;
          if (!details || Object.keys(details).length === 0) return "—";
          return (
            <dl className="flex flex-col gap-0.5">
              {Object.entries(details).map(([cle, valeur]) => (
                <div key={cle} className="flex gap-1">
                  <dt className="text-texte-tertiaire">{cle}</dt>
                  <dd className="font-medium">{valeurLisible(valeur)}</dd>
                </div>
              ))}
            </dl>
          );
        },
      },
    ],
    [t, nomUtilisateur],
  );

  /** Tout changement de filtre ramène en page 1 : rester en page 4 d'un résultat qui n'en a plus
   *  qu'une afficherait un tableau vide sans rien expliquer. */
  function filtrer(appliquer: () => void) {
    appliquer();
    setPage(0);
  }

  const actionsDisponibles = requete.data?.actionsDisponibles ?? [];

  return (
    <section className="flex flex-col gap-4 rounded border border-bordure bg-surface p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--taille-lg)] font-semibold tracking-tight">{t("titre")}</h2>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
          {t("description")}
        </p>
        <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
          {t("perimetre")}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Champ id="journal-auteur" label={t("filtreAuteur")}>
          <Select
            id="journal-auteur"
            value={auteur}
            onChange={(evenement) => filtrer(() => setAuteur(evenement.target.value))}
          >
            <option value="">{t("tousLesAuteurs")}</option>
            {(utilisateurs.data ?? []).map((utilisateur) => (
              <option key={utilisateur.id} value={utilisateur.id}>
                {nomUtilisateur(utilisateur.id)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="journal-action" label={t("filtreAction")}>
          <Select
            id="journal-action"
            value={action}
            onChange={(evenement) => filtrer(() => setAction(evenement.target.value))}
          >
            <option value="">{t("toutesLesActions")}</option>
            {actionsDisponibles.map((libelle) => (
              <option key={libelle} value={libelle}>
                {libelle}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="journal-debut" label={t("du")}>
          <Input
            id="journal-debut"
            type="date"
            value={debut}
            enErreur={fenetreInversee}
            onChange={(evenement) => filtrer(() => setDebut(evenement.target.value))}
          />
        </Champ>

        <Champ id="journal-fin" label={t("au")}>
          <Input
            id="journal-fin"
            type="date"
            value={fin}
            enErreur={fenetreInversee}
            onChange={(evenement) => filtrer(() => setFin(evenement.target.value))}
          />
        </Champ>

        <Button
          variante="secondaire"
          onClick={() =>
            filtrer(() => {
              setAuteur("");
              setAction("");
              setDebut("");
              setFin("");
            })
          }
        >
          {t("reinitialiser")}
        </Button>
      </div>

      {fenetreInversee ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {t("fenetreInversee")}
        </p>
      ) : null}

      <TableDonnees
        colonnes={colonnes as never}
        donnees={requete.data}
        chargement={requete.isLoading}
        erreur={requete.error}
        page={page}
        onChangementPage={setPage}
        taille={taille}
        onChangementTaille={(nouvelle) => {
          setTaille(nouvelle);
          setPage(0);
        }}
        titreVide={t("videTitre")}
        descriptionVide={t("videTexte")}
        onReessayer={() => void requete.refetch()}
        cleLigne={(ligne) => String((ligne as HistoriqueAction).id)}
      />
    </section>
  );
}
