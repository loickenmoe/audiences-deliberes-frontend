"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { DateHeureValeur, TableDonnees } from "@/components/metier";
import { ExportAudit } from "@/components/modules/audit/export-audit";
import { VerificateurEmpreinte } from "@/components/modules/audit/verificateur-empreinte";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { TAILLE_PAGE } from "@/hooks/const";
import { useAudit } from "@/hooks/useAudit";
import { useLibelles } from "@/hooks/useLibelles";
import { useLibellesHistorique } from "@/hooks/useLibellesHistorique";
import { useUtilisateurs } from "@/hooks/useReferentiels";
import type { PerimetreAudit } from "@/services/auditService";
import type { HistoriqueAction } from "@/types/domaine";

/** Rend une valeur de `details`, dont la forme varie d'une action à l'autre. */
function valeurLisible(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

/**
 * Écran d'audit — DJ et DJA (backend Q-112).
 *
 * **Ce qu'il ouvre.** Le journal de Q-110 répondait à une question de *couverture* : des lignes
 * existaient sans aucun point de lecture. Restait une question de *point d'entrée* — « qu'a fait X
 * le mois dernier ? », « toutes les suppressions du trimestre ? », « que s'est-il passé entre le 1er
 * et le 15 ? ». Aucune ne part d'un dossier, et aucune n'était donc possible. C'est ce que cet écran
 * permet, et c'est pourquoi le journal y déménage plutôt que de coexister : deux endroits où
 * chercher la même trace sont la fragmentation qu'on voulait supprimer.
 *
 * **Deux tâches, deux écrans.** Administrer — lire un réglage, le changer — reste sur l'écran des
 * paramètres. Enquêter — remonter le temps, croiser auteur, période et nature — se fait ici. Un
 * journal paginé à quatre filtres est un outil d'enquête ; le placer sous les paramètres revenait à
 * poser un outil d'enquête sur un écran d'administration.
 *
 * **Pourquoi « audit » cette fois, et pas « journal ».** Le nom se justifie parce que la portée est
 * complète — tout l'historique, tous les périmètres. Il reste une limite, que l'écran énonce
 * lui-même plutôt que de la laisser découvrir : **seules les modifications sont tracées**. Aucune
 * consultation ne l'est, hormis celle de cet écran. L'absence de ligne ne prouve pas l'absence
 * d'action.
 *
 * **Toute consultation est historisée**, avec ses critères. Ce n'est pas une contrainte imposée au
 * DJ et à la DJA : c'est ce qui leur permet de démontrer qu'ils n'ont regardé que ce qu'ils devaient
 * — protection de ceux qui consultent autant que de ceux qui sont consultés.
 */
export function ConsultationAudit() {
  const t = useTranslations("audit");
  const { nomUtilisateur } = useLibelles();
  const { libelleAction, libelleDetail } = useLibellesHistorique();
  const utilisateurs = useUtilisateurs();

  const [perimetre, setPerimetre] = useState<PerimetreAudit>("TOUT");
  const [dossier, setDossier] = useState("");
  const [auteur, setAuteur] = useState("");
  const [code, setCode] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [page, setPage] = useState(0);
  const [taille, setTaille] = useState(TAILLE_PAGE);

  const fenetreInversee = Boolean(debut && fin && debut > fin);
  const dossierManquant = perimetre === "UN_DOSSIER" && !dossier.trim();
  const criteresInvalides = fenetreInversee || dossierManquant;

  const requete = useAudit(
    {
      perimetre,
      dossierId: perimetre === "UN_DOSSIER" && dossier ? Number(dossier) : undefined,
      utilisateurId: auteur ? Number(auteur) : undefined,
      code: code || undefined,
      dateDebut: debut || undefined,
      dateFin: fin || undefined,
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
        // QF-24 : le libellé vient du **code typé**, pas de la phrase du backend. Celle-ci reste
        // le repli, pour qu'un code non encore traduit s'affiche lisiblement plutôt qu'en brut.
        cell: ({ row }: { row: { original: HistoriqueAction } }) =>
          libelleAction(row.original.code, row.original.action),
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
                  <dt className="text-texte-tertiaire">{libelleDetail(cle)}</dt>
                  <dd className="font-medium">{valeurLisible(valeur)}</dd>
                </div>
              ))}
            </dl>
          );
        },
      },
    ],
    [t, nomUtilisateur, libelleAction, libelleDetail],
  );

  /**
   * Tout changement de filtre ramène en page 1 : rester en page 4 d'un résultat qui n'en a plus
   * qu'une afficherait un tableau vide sans rien expliquer.
   */
  function filtrer(appliquer: () => void) {
    appliquer();
    setPage(0);
  }

  const actionsDisponibles = requete.data?.actionsDisponibles ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-tertiaire">
          {t("perimetreCouvert")}
        </p>
        {/*
          Dit à qui consulte que sa consultation est tracée. L'annoncer plutôt que de le taire est ce
          qui distingue un dispositif accepté d'un dispositif subi — et cela protège autant le DJ et
          la DJA, en démontrant qu'ils n'ont regardé que ce qu'ils devaient.
        */}
        <p className="max-w-prose text-[length:var(--taille-sm)] font-medium">{t("consultationTracee")}</p>
      </header>

      <section
        aria-label={t("filtres")}
        className="flex flex-wrap items-end gap-3 rounded border border-bordure bg-surface p-4"
      >
        <Champ id="audit-perimetre" label={t("filtrePerimetre")}>
          <Select
            id="audit-perimetre"
            value={perimetre}
            onChange={(evenement) =>
              filtrer(() => {
                const choisi = evenement.target.value as PerimetreAudit;
                setPerimetre(choisi);
                if (choisi !== "UN_DOSSIER") setDossier("");
              })
            }
          >
            <option value="TOUT">{t("perimetreTout")}</option>
            <option value="HORS_DOSSIER">{t("perimetreHorsDossier")}</option>
            <option value="UN_DOSSIER">{t("perimetreUnDossier")}</option>
          </Select>
        </Champ>

        {perimetre === "UN_DOSSIER" ? (
          <Champ id="audit-dossier" label={t("filtreDossier")}>
            <Input
              id="audit-dossier"
              placeholder={t("phDossier")}
              type="number"
              min={1}
              value={dossier}
              enErreur={dossierManquant}
              onChange={(evenement) => filtrer(() => setDossier(evenement.target.value))}
            />
          </Champ>
        ) : null}

        <Champ id="audit-auteur" label={t("filtreAuteur")}>
          <Select
            id="audit-auteur"
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

        <Champ id="audit-action" label={t("filtreAction")}>
          <Select
            id="audit-action"
            value={code}
            onChange={(evenement) => filtrer(() => setCode(evenement.target.value))}
          >
            <option value="">{t("toutesLesActions")}</option>
            {/*
              Le libellé du filtre est traduit comme celui des lignes (QF-24) : sans cela, on aurait
              choisi une entrée en français pour voir se remplir un tableau en anglais.
            */}
            {actionsDisponibles.map((option) => (
              <option key={option.code} value={option.code}>
                {libelleAction(option.code, option.libelle)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="audit-debut" label={t("du")}>
          <Input
            id="audit-debut"
            type="date"
            value={debut}
            enErreur={fenetreInversee}
            onChange={(evenement) => filtrer(() => setDebut(evenement.target.value))}
          />
        </Champ>

        <Champ id="audit-fin" label={t("au")}>
          <Input
            id="audit-fin"
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
              setPerimetre("TOUT");
              setDossier("");
              setAuteur("");
              setCode("");
              setDebut("");
              setFin("");
            })
          }
        >
          {t("reinitialiser")}
        </Button>

        {/*
          Les critères incohérents sont arrêtés ici plutôt que laissés partir : le backend les refuse
          en 400, mais l'utilisateur lirait un message technique là où il a simplement inversé deux
          dates ou oublié un numéro de dossier.

          Le message vit **dans la section des filtres**, auprès de ce qui le provoque. Le placer
          au-dessus du tableau l'éloignait du champ fautif — et le rendait indiscernable, pour un
          test comme pour un lecteur d'écran, de l'annonceur de route que Next pose à la racine du
          document avec le même rôle.
        */}
        {criteresInvalides ? (
          <p role="alert" className="w-full text-[length:var(--taille-sm)] text-danger">
            {fenetreInversee ? t("fenetreInversee") : t("dossierManquant")}
          </p>
        ) : null}
      </section>

      {/*
        L'extraction vit sous les filtres, et reprend les mêmes : ce qu'on exporte est ce qu'on
        regarde. Un bloc d'export qui aurait ses propres critères aurait produit des archives sans
        rapport avec l'écran où on les demande.
      */}
      <ExportAudit
        filtres={{
          perimetre,
          dossierId: perimetre === "UN_DOSSIER" && dossier ? Number(dossier) : undefined,
          utilisateurId: auteur ? Number(auteur) : undefined,
          code: code || undefined,
        }}
        debut={debut}
        fin={fin}
        onPeriode={(periode) =>
          filtrer(() => {
            setDebut(periode.debut);
            setFin(periode.fin);
          })
        }
      />

      {/*
        Le vérificateur suit l'extraction : produire une pièce et pouvoir la vérifier sont les deux
        moitiés du même geste. Séparés, l'empreinte reste une curiosité que personne ne contrôle.
      */}
      <VerificateurEmpreinte />

      {criteresInvalides ? null : (
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
      )}
    </div>
  );
}
