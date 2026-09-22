"use client";

import { Archive, Gavel, Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateValeur, MontantFcfa } from "@/components/metier";
import { ListeJurisprudences } from "@/components/modules/jurisprudence/liste-jurisprudences";
import { ModaleArchivage } from "@/components/modules/jurisprudence/modale-archivage";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import {
  useCreerAdjudication,
  useCreerCondamnation,
  useDecisionsDossier,
  useJurisprudences,
  useModifierStatutCondamnation,
} from "@/hooks/useDecisions";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { Condamnation, Dossier, EtapeProcedure } from "@/types/domaine";
import { SensCondamnation, StatutPaiementCondamnation } from "@/types/enums";

const TON_PAIEMENT: Record<StatutPaiementCondamnation, TonStatut> = {
  EN_ATTENTE: "attention",
  PAYE: "succes",
  RECOUVREMENT_FORCE: "danger",
};

/**
 * Écran 14 — décisions devenues définitives du dossier (UC-DEF-01 à 03) : adjudications,
 * condamnations pécuniaires et décisions archivées. La lecture existe depuis Q-88 (QF-03) ; sans
 * elle, le statut d'une condamnation devenait inatteignable après un rechargement.
 */
export function OngletDecisions({ dossier, roles }: { dossier: Dossier; roles: readonly string[] }) {
  const t = useTranslations("decisions");
  const td = useTranslations("domaine");
  const requete = useDecisionsDossier(dossier.id);
  const archives = useJurisprudences({ dossierId: dossier.id });
  const peutGerer = peut(roles, "gererDecisions");
  const [modale, setModale] = useState<"adjudication" | "condamnation" | "archivage" | null>(null);
  const etapes = dossier.etapes ?? [];
  const etapesCloturees = etapes.filter((e) => e.statutCycleVie === "CLOTURE");

  const libelleEtape = (etapeId: number | null) => {
    const etape = etapes.find((e) => e.id === etapeId);
    return etape ? td(`TypeEtape.${etape.type}` as never) : "—";
  };

  if (requete.isLoading) return <EtatChargement lignes={6} />;
  if (requete.error || !requete.data) return <EtatErreur message={messageErreur(requete.error)} />;

  const { adjudications, condamnations } = requete.data;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="decisions-adjudications" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="decisions-adjudications" className="font-semibold">{t("adjudications")}</h2>
          {peutGerer ? (
            <Button variante="secondaire" onClick={() => setModale("adjudication")} disabled={etapesCloturees.length === 0}>
              <Gavel size={15} aria-hidden />
              {t("enregistrerAdjudication")}
            </Button>
          ) : null}
        </div>
        {peutGerer && etapesCloturees.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("sansEtapeCloturee")}</p>
        ) : null}
        {adjudications.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneAdjudication")}</p>
        ) : (
          <div className="overflow-x-auto rounded border border-bordure bg-surface">
            <table className="w-full text-left text-[length:var(--taille-sm)]">
              <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneBeneficiaire")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneEtape")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneDate")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneSuivi")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneReliquat")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {adjudications.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium">{a.beneficiaire}</td>
                    <td className="px-4 py-2">{libelleEtape(a.etapeId)}</td>
                    <td className="px-4 py-2"><DateValeur valeur={a.dateDecision} /></td>
                    <td className="px-4 py-2">
                      <ul className="flex flex-col gap-0.5 text-[length:var(--taille-xs)]">
                        {a.statutComptabilisation ? <li>{t("comptabilisation", { statut: a.statutComptabilisation })}</li> : null}
                        {a.repriseProvision ? <li>{t("repriseProvision")}</li> : null}
                        {a.restitutionSoulte ? <li>{t("restitutionSoulte")}</li> : null}
                        {a.mutation ? <li>{t("mutation")}</li> : null}
                      </ul>
                    </td>
                    <td className="px-4 py-2"><MontantFcfa valeur={a.reliquat} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="decisions-condamnations" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="decisions-condamnations" className="font-semibold">{t("condamnations")}</h2>
          {peutGerer ? (
            <Button variante="secondaire" onClick={() => setModale("condamnation")}>
              <Scale size={15} aria-hidden />
              {t("suivreCondamnation")}
            </Button>
          ) : null}
        </div>
        {condamnations.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneCondamnation")}</p>
        ) : (
          <div className="overflow-x-auto rounded border border-bordure bg-surface">
            <table className="w-full text-left text-[length:var(--taille-sm)]">
              <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneNature")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneSens")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneDate")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneEtape")}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("colonneStatut")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {condamnations.map((c) => (
                  <LigneCondamnation
                    key={c.id}
                    condamnation={c}
                    dossierId={dossier.id}
                    peutGerer={peutGerer}
                    libelleEtape={libelleEtape(c.etapeId)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="decisions-archivees" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="decisions-archivees" className="font-semibold">{t("archivees")}</h2>
          {peutGerer ? (
            <Button variante="secondaire" onClick={() => setModale("archivage")}>
              <Archive size={15} aria-hidden />
              {t("archiver")}
            </Button>
          ) : null}
        </div>
        {archives.isLoading ? (
          <EtatChargement lignes={2} />
        ) : archives.error ? (
          <EtatErreur message={messageErreur(archives.error)} />
        ) : (archives.data?.content ?? []).length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucuneArchivee")}</p>
        ) : (
          <ListeJurisprudences
            jurisprudences={archives.data?.content ?? []}
            avecDossier={false}
            rafraichir={async () => (await archives.refetch()).data?.content ?? []}
          />
        )}
      </section>

      {peutGerer ? (
        <>
          <ModaleAdjudication
            dossierId={dossier.id}
            etapes={etapesCloturees}
            ouvert={modale === "adjudication"}
            onFermeture={() => setModale(null)}
          />
          <ModaleCondamnation
            dossierId={dossier.id}
            etapes={etapes}
            ouvert={modale === "condamnation"}
            onFermeture={() => setModale(null)}
          />
          <ModaleArchivage dossierId={dossier.id} ouvert={modale === "archivage"} onFermeture={() => setModale(null)} />
        </>
      ) : null}
    </div>
  );
}

/** UC-DEF-02 étape 8 : le statut de paiement se met à jour au fil de l'exécution. */
function LigneCondamnation({
  condamnation,
  dossierId,
  peutGerer,
  libelleEtape,
}: {
  condamnation: Condamnation;
  dossierId: number;
  peutGerer: boolean;
  libelleEtape: string;
}) {
  const t = useTranslations("decisions");
  const td = useTranslations("domaine");
  const modifier = useModifierStatutCondamnation(dossierId);
  const [statut, setStatut] = useState<StatutPaiementCondamnation>(condamnation.statutPaiement);

  useEffect(() => setStatut(condamnation.statutPaiement), [condamnation.statutPaiement]);

  async function enregistrer() {
    try {
      await modifier.mutateAsync({ id: condamnation.id, statutPaiement: statut });
      toast.success(t("statutMisAJour"));
    } catch (e) {
      toast.error(messageErreur(e));
    }
  }

  return (
    <tr>
      <td className="px-4 py-2 font-medium">{condamnation.naturePaiement}</td>
      <td className="px-4 py-2">{td(`SensCondamnation.${condamnation.sens}` as never)}</td>
      <td className="px-4 py-2"><DateValeur valeur={condamnation.dateDecision} /></td>
      <td className="px-4 py-2">{libelleEtape}</td>
      <td className="px-4 py-2">
        {peutGerer ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label={t("statutAria", { nature: condamnation.naturePaiement })}
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutPaiementCondamnation)}
              className="w-44"
            >
              {StatutPaiementCondamnation.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {td(`StatutPaiementCondamnation.${valeur}` as never)}
                </option>
              ))}
            </Select>
            <Button
              variante="secondaire"
              taille="sm"
              onClick={() => void enregistrer()}
              disabled={statut === condamnation.statutPaiement || modifier.isPending}
            >
              {t("mettreAJour")}
            </Button>
          </div>
        ) : (
          <StatutChip ton={TON_PAIEMENT[condamnation.statutPaiement]}>
            {td(`StatutPaiementCondamnation.${condamnation.statutPaiement}` as never)}
          </StatutChip>
        )}
      </td>
    </tr>
  );
}

function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** UC-DEF-01 : bénéficiaire et suivi financier, sur une étape clôturée (RG-DEF-01/02). */
function ModaleAdjudication({
  dossierId,
  etapes,
  ouvert,
  onFermeture,
}: {
  dossierId: number;
  etapes: EtapeProcedure[];
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("decisions");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const creer = useCreerAdjudication(dossierId);
  const [etapeId, setEtapeId] = useState("");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [comptabilisation, setComptabilisation] = useState("");
  const [repriseProvision, setRepriseProvision] = useState(false);
  const [restitutionSoulte, setRestitutionSoulte] = useState(false);
  const [mutation, setMutation] = useState(false);
  const [reliquat, setReliquat] = useState("0");
  const [dateDecision, setDateDecision] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (ouvert) {
      setEtapeId(etapes.length === 1 ? String(etapes[0]!.id) : "");
      setBeneficiaire("");
      setComptabilisation("");
      setRepriseProvision(false);
      setRestitutionSoulte(false);
      setMutation(false);
      setReliquat("0");
      setDateDecision(aujourdhui());
      setErreurs({});
    }
  }, [ouvert, etapes]);

  async function soumettre() {
    const obligatoire = tm("champObligatoire");
    const montant = Number(reliquat);
    const suivantes = {
      etapeId: etapeId ? undefined : obligatoire,
      beneficiaire: beneficiaire.trim() ? undefined : obligatoire,
      comptabilisation: comptabilisation.trim() ? undefined : obligatoire,
      reliquat: reliquat.trim() === "" || Number.isNaN(montant) ? obligatoire : montant < 0 ? t("reliquatNegatif") : undefined,
      dateDecision: dateDecision ? undefined : obligatoire,
    };
    setErreurs(suivantes);
    if (Object.values(suivantes).some(Boolean)) return;
    try {
      await creer.mutateAsync({
        etapeId: Number(etapeId),
        beneficiaire: beneficiaire.trim(),
        statutComptabilisation: comptabilisation.trim(),
        repriseProvision,
        restitutionSoulte,
        mutation,
        reliquat: montant,
        dateDecision,
      });
      toast.success(t("adjudicationEnregistree"));
      onFermeture();
    } catch (e) {
      setErreurs({ general: messageErreur(e) });
    }
  }

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("enregistrerAdjudication")}
      description={t("adjudicationAide")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={creer.isPending}>{tc("annuler")}</Button>
          <Button onClick={() => void soumettre()} disabled={creer.isPending}>{tc("enregistrer")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Champ id="adjudication-etape" label={t("champEtape")} obligatoire erreur={erreurs.etapeId}>
          <Select id="adjudication-etape" value={etapeId} onChange={(e) => setEtapeId(e.target.value)}>
            <option value="">{t("choisirEtape")}</option>
            {etapes.map((e) => (
              <option key={e.id} value={e.id}>{td(`TypeEtape.${e.type}` as never)}</option>
            ))}
          </Select>
        </Champ>
        <Champ id="adjudication-beneficiaire" label={t("champBeneficiaire")} obligatoire erreur={erreurs.beneficiaire}>
          <Input id="adjudication-beneficiaire" maxLength={100} value={beneficiaire} onChange={(e) => setBeneficiaire(e.target.value)} />
        </Champ>
        <Champ id="adjudication-comptabilisation" label={t("champComptabilisation")} obligatoire erreur={erreurs.comptabilisation}>
          <Input id="adjudication-comptabilisation" maxLength={30} value={comptabilisation} onChange={(e) => setComptabilisation(e.target.value)} />
        </Champ>
        <fieldset className="flex flex-col gap-2 text-[length:var(--taille-sm)]">
          <legend className="mb-1 font-medium">{t("suiviFinancier")}</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={repriseProvision} onChange={(e) => setRepriseProvision(e.target.checked)} />
            {t("repriseProvision")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={restitutionSoulte} onChange={(e) => setRestitutionSoulte(e.target.checked)} />
            {t("restitutionSoulte")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mutation} onChange={(e) => setMutation(e.target.checked)} />
            {t("mutation")}
          </label>
        </fieldset>
        <Champ id="adjudication-reliquat" label={t("champReliquat")} obligatoire erreur={erreurs.reliquat}>
          <Input id="adjudication-reliquat" type="number" min={0} step="1" value={reliquat} onChange={(e) => setReliquat(e.target.value)} />
        </Champ>
        <Champ id="adjudication-date" label={t("champDate")} obligatoire erreur={erreurs.dateDecision}>
          <Input id="adjudication-date" type="date" value={dateDecision} onChange={(e) => setDateDecision(e.target.value)} />
        </Champ>
        {erreurs.general ? <p role="alert" className="text-[length:var(--taille-sm)] text-danger">{erreurs.general}</p> : null}
      </div>
    </Dialog>
  );
}

/** UC-DEF-02 : sens, nature du paiement, date ; l'étape est facultative (Q-59). */
function ModaleCondamnation({
  dossierId,
  etapes,
  ouvert,
  onFermeture,
}: {
  dossierId: number;
  etapes: EtapeProcedure[];
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("decisions");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const creer = useCreerCondamnation(dossierId);
  const [sens, setSens] = useState("");
  const [nature, setNature] = useState("");
  const [dateDecision, setDateDecision] = useState("");
  const [etapeId, setEtapeId] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    if (ouvert) {
      setSens("");
      setNature("");
      setDateDecision(aujourdhui());
      setEtapeId("");
      setErreurs({});
    }
  }, [ouvert]);

  async function soumettre() {
    const obligatoire = tm("champObligatoire");
    const suivantes = {
      sens: sens ? undefined : obligatoire,
      nature: nature.trim() ? undefined : obligatoire,
      dateDecision: dateDecision ? undefined : obligatoire,
    };
    setErreurs(suivantes);
    if (Object.values(suivantes).some(Boolean)) return;
    try {
      await creer.mutateAsync({
        sens: sens as SensCondamnation,
        naturePaiement: nature.trim(),
        dateDecision,
        etapeId: etapeId ? Number(etapeId) : undefined,
      });
      toast.success(t("condamnationEnregistree"));
      onFermeture();
    } catch (e) {
      setErreurs({ general: messageErreur(e) });
    }
  }

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("suivreCondamnation")}
      description={t("condamnationAide")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={creer.isPending}>{tc("annuler")}</Button>
          <Button onClick={() => void soumettre()} disabled={creer.isPending}>{tc("enregistrer")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Champ id="condamnation-sens" label={t("champSens")} obligatoire erreur={erreurs.sens}>
          <Select id="condamnation-sens" value={sens} onChange={(e) => setSens(e.target.value)}>
            <option value="">{t("choisirSens")}</option>
            {SensCondamnation.map((valeur) => (
              <option key={valeur} value={valeur}>{td(`SensCondamnation.${valeur}` as never)}</option>
            ))}
          </Select>
        </Champ>
        <Champ id="condamnation-nature" label={t("champNature")} obligatoire erreur={erreurs.nature}>
          <Input id="condamnation-nature" maxLength={50} value={nature} onChange={(e) => setNature(e.target.value)} />
        </Champ>
        <Champ id="condamnation-date" label={t("champDate")} obligatoire erreur={erreurs.dateDecision}>
          <Input id="condamnation-date" type="date" value={dateDecision} onChange={(e) => setDateDecision(e.target.value)} />
        </Champ>
        <Champ id="condamnation-etape" label={t("champEtapeFacultative")}>
          <Select id="condamnation-etape" value={etapeId} onChange={(e) => setEtapeId(e.target.value)}>
            <option value="">{t("aucuneEtape")}</option>
            {etapes.map((e) => (
              <option key={e.id} value={e.id}>{td(`TypeEtape.${e.type}` as never)}</option>
            ))}
          </Select>
        </Champ>
        {erreurs.general ? <p role="alert" className="text-[length:var(--taille-sm)] text-danger">{erreurs.general}</p> : null}
      </div>
    </Dialog>
  );
}
