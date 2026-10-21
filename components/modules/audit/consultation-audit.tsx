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

/** Renders a `details` value, whose shape varies from one action to another. */
function valeurLisible(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  if (typeof valeur === "string") return valeur;
  // What remains of a JSON value: a number or a boolean.
  return typeof valeur === "number" || typeof valeur === "boolean" ? String(valeur) : "—";
}

/** The `details` of an action, as label / value pairs; "—" when there are none. */
function DetailsAction({ details }: Readonly<{ details: HistoriqueAction["details"] }>) {
  const { libelleDetail } = useLibellesHistorique();
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
}

function colonnesAudit(
  t: ReturnType<typeof useTranslations<"audit">>,
  nomUtilisateur: (id: number) => string,
  libelleAction: (code: string, action: string) => string,
) {
  return [
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
        row.original.utilisateurId === null ? "—" : nomUtilisateur(row.original.utilisateurId),
    },
    {
      id: "action",
      header: t("colonneAction"),
      // The label comes from the typed code, not the backend sentence, which remains the fallback
      // so an untranslated code is still readable.
      cell: ({ row }: { row: { original: HistoriqueAction } }) =>
        libelleAction(row.original.code, row.original.action),
    },
    {
      id: "details",
      header: t("colonneDetails"),
      cell: ({ row }: { row: { original: HistoriqueAction } }) => (
        <DetailsAction details={row.original.details} />
      ),
    },
  ];
}

/**
 * Audit screen - DJ and DJA.
 * Search across the whole audit log by author, period, nature and case, independently of any case.
 * Settings administration stays on the settings screen.
 * Only modifications are logged; no read access is, except this screen's own consultations (with
 * their criteria). The missing line does not prove an action did not happen, and the screen says
 * so.
 */
export function ConsultationAudit() {
  const t = useTranslations("audit");
  const { nomUtilisateur } = useLibelles();
  const { libelleAction } = useLibellesHistorique();
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
    () => colonnesAudit(t, nomUtilisateur, libelleAction),
    [t, nomUtilisateur, libelleAction],
  );

  /**
   * Any filter change returns to page 1: staying on page 4 of a result with one page would show an
   * empty table with no explanation.
   */
  function filtrer(appliquer: () => void) {
    appliquer();
    setPage(0);
  }

  const actionsDisponibles = requete.data?.actionsDisponibles ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("titre")}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-tertiaire">
          {t("perimetreCouvert")}
        </p>
        {/* Tells the viewer that their consultation is logged. */}
        <p className="max-w-prose text-[length:var(--taille-sm)] font-medium">
          {t("consultationTracee")}
        </p>
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
            {/* The filter label is translated like the rows' labels. */}
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
          Inconsistent criteria are stopped here: the backend rejects them with a 400, but the user
          would see a technical message for swapping two dates or omitting a case number.
          The message sits in the filter section, next to its cause, and stays distinct from the
          Next route announcer that uses the same role at the document root.
        */}
        {criteresInvalides ? (
          <p role="alert" className="w-full text-[length:var(--taille-sm)] text-danger">
            {fenetreInversee ? t("fenetreInversee") : t("dossierManquant")}
          </p>
        ) : null}
      </section>

      {/* The export sits under the filters and reuses them: what is exported is what is displayed. */}
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
        The verifier follows the export: producing a document and verifying it are two halves of one
        task.
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
          cleLigne={(ligne) => String(ligne.id)}
        />
      )}
    </div>
  );
}
