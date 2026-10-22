"use client";

import { Download, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur, EtatVide, StatutChip } from "@/components/global";
import { DateHeureValeur, DateValeur, PoidsFichier } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { SelecteurDossier } from "@/components/modules/portail/selecteur-dossier";
import { Button } from "@/components/ui/button";
import { useAudiencesDeMonDossier, usePiecesDeMonDossier } from "@/hooks/usePortailAvocat";
import { messageErreur } from "@/lib/api/errors";
import { estTypeConnu, telechargerBlob } from "@/lib/documents";
import { portailAvocatService, type PieceAvocat } from "@/services/portailAvocatService";

/**
 * The lawyer's case files: hearings and the documents the bank shares with them.
 *
 * Hearings are visible from assignment. The Legal Department's note and the documents become visible
 * only once the lawyer is formally appointed (letter signed by the SH). The server checks this on
 * every read; the screen only explains why a list is empty ("not yet appointed" vs "no document").
 * The legal officer's hearing report is never shown: it stays internal (RG-INT-07).
 */
export function MesDossiers() {
  const t = useTranslations("portail");
  const [dossierId, setDossierId] = useState<number | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[length:var(--taille-lg)] font-semibold">{t("mesDossiers")}</h2>
      <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">{t("mesDossiersTexte")}</p>
      <div className="max-w-md">
        <SelecteurDossier id="dossier-espace" obligatoire={false} valeur={dossierId} onChangement={setDossierId} />
      </div>
      {dossierId === null ? null : (
        <div className="flex flex-col gap-6">
          <AudiencesDuDossier dossierId={dossierId} />
          <PiecesDuDossier dossierId={dossierId} />
        </div>
      )}
    </section>
  );
}

function AudiencesDuDossier({ dossierId }: Readonly<{ dossierId: number }>) {
  const t = useTranslations("portail");
  const td = useTranslations("domaine");
  const requete = useAudiencesDeMonDossier(dossierId);

  if (requete.isLoading) return <EtatChargement lignes={3} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;
  const audiences = requete.data ?? [];

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[length:var(--taille-base)] font-semibold">{t("audiencesTitre")}</h3>
      {audiences.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("audiencesVide")}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDateAudience")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneJuridiction")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneStatut")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneNote")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {audiences.map((audience) => (
                <tr key={audience.id}>
                  <td className="px-4 py-2 font-medium">
                    <DateValeur valeur={audience.datePlanifiee} />
                  </td>
                  <td className="px-4 py-2">{audience.juridiction ?? "-"}</td>
                  <td className="px-4 py-2">
                    <StatutChip>{td(`StatutAudience.${audience.statut}` as never)}</StatutChip>
                  </td>
                  {/* The note's line breaks are the legal officer's: they are part of the message. */}
                  <td className="max-w-prose whitespace-pre-wrap px-4 py-2">{audience.noteAvocat ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PiecesDuDossier({ dossierId }: Readonly<{ dossierId: number }>) {
  const t = useTranslations("portail");
  const tdoc = useTranslations("documents");
  const tf = useTranslations("fiche");
  const requete = usePiecesDeMonDossier(dossierId);
  const [apercu, setApercu] = useState<PieceAvocat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function libelleType(type: string | null) {
    if (!type) return "-";
    return estTypeConnu(type) ? tdoc(`types.${type}` as never) : type;
  }

  async function telecharger(piece: PieceAvocat) {
    setErreur(null);
    try {
      telechargerBlob(await portailAvocatService.contenuPiece(dossierId, piece.id), piece.nomFichier);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  if (requete.isLoading) return <EtatChargement lignes={3} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;
  const reponse = requete.data;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[length:var(--taille-base)] font-semibold">{t("piecesTitre")}</h3>
      {erreur ? (
        <p role="alert" className="text-[length:var(--taille-sm)] text-danger">
          {erreur}
        </p>
      ) : null}
      {reponse?.constitue ? null : (
        <EtatVide titre={t("piecesNonConstitue")} description={t("piecesNonConstitueTexte")} />
      )}
      {reponse?.constitue && reponse.pieces.length === 0 ? (
        <EtatVide titre={t("piecesVide")} description={t("piecesVideTexte")} />
      ) : null}
      {reponse?.constitue && reponse.pieces.length > 0 ? (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePiece")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{tdoc("colonneType")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{tf("colonnePoids")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePartagee")}</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">{tdoc("colonneActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {reponse.pieces.map((piece) => (
                <tr key={piece.id}>
                  <td className="px-4 py-2">{piece.nomFichier}</td>
                  <td className="px-4 py-2">{libelleType(piece.typeDocument)}</td>
                  <td className="px-4 py-2">
                    <PoidsFichier valeur={piece.poids} />
                  </td>
                  <td className="px-4 py-2">
                    <DateHeureValeur valeur={piece.partageLe} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => setApercu(piece)}
                        aria-label={`${tdoc("consulter")} - ${piece.nomFichier}`}
                      >
                        <Eye size={14} aria-hidden />
                        {tdoc("consulter")}
                      </Button>
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => void telecharger(piece)}
                        aria-label={`${tdoc("telecharger")} - ${piece.nomFichier}`}
                      >
                        <Download size={14} aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.nomFichier ?? ""}
        obtenir={() =>
          apercu ? portailAvocatService.contenuPiece(dossierId, apercu.id) : Promise.reject(new Error("aucune pièce"))
        }
      />
    </div>
  );
}
