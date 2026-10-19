"use client";

import { Check, Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { DateHeureValeur, DialogueConfirmation, Pagination } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { ModaleRejetPartage } from "@/components/modules/ged/modale-rejet-partage";
import { Button } from "@/components/ui/button";
import { useArbitrerPartage, usePartagesAvocat } from "@/hooks/useGed";
import { messageErreur } from "@/lib/api/errors";
import { gedService } from "@/services/gedService";
import type { PartageAvocat } from "@/types/domaine";

async function contenuPiece(documentId: number): Promise<Blob> {
  const document = await gedService.consulter(documentId);
  if (!document.urlTelechargement) throw new Error("URL de téléchargement absente");
  return gedService.recupererContenu(document.urlTelechargement);
}

/**
 * Document shares awaiting approval.
 *
 * On a sensitive case file, sharing a document with the lawyer is reserved to the DJ and the DJA:
 * the legal officer proposes it, and nothing is visible to the lawyer before approval. Oldest first,
 * same layout as the deletion request queue.
 * The document can be previewed before deciding; a rejection requires a reason, sent to the legal officer.
 */
export function FilePartages() {
  const t = useTranslations("partages");
  const tdoc = useTranslations("documents");
  const [page, setPage] = useState(0);
  const requete = usePartagesAvocat(page);
  const arbitrer = useArbitrerPartage();

  const [apercu, setApercu] = useState<PartageAvocat | null>(null);
  const [aValider, setAValider] = useState<PartageAvocat | null>(null);
  const [aRejeter, setARejeter] = useState<PartageAvocat | null>(null);

  async function valider() {
    if (!aValider) return;
    try {
      await arbitrer.mutateAsync({ documentId: aValider.documentId });
      toast.success(tdoc("partageValide"));
    } catch (e) {
      toast.error(messageErreur(e));
    } finally {
      setAValider(null);
    }
  }

  const partages = requete.data?.content ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
      </header>

      {requete.isLoading ? (
        <EtatChargement lignes={4} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : partages.length === 0 ? (
        <EtatVide titre={t("vide")} description={t("videTexte")} />
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePiece")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDossier")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonnePropose")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneDate")}</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">{t("colonneActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {partages.map((partage) => (
                <tr key={partage.documentId}>
                  <td className="px-4 py-2">{partage.nomFichier}</td>
                  <td className="px-4 py-2">
                    {/* Links to the Documents tab, where the document lives alongside the others. */}
                    <Link
                      href={`/dossiers/${partage.dossierId}?onglet=documents`}
                      className="font-mono underline underline-offset-2"
                    >
                      {partage.referenceDossier}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{partage.partageParNom ?? "-"}</td>
                  <td className="px-4 py-2">
                    <DateHeureValeur valeur={partage.partageLe} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => setApercu(partage)}
                        aria-label={`${tdoc("consulter")} - ${partage.nomFichier}`}
                      >
                        <Eye size={14} aria-hidden />
                        {tdoc("consulter")}
                      </Button>
                      <Button
                        taille="sm"
                        onClick={() => setAValider(partage)}
                        aria-label={t("validerAria", { nom: partage.nomFichier })}
                      >
                        <Check size={14} aria-hidden />
                        {tdoc("validerPartage")}
                      </Button>
                      <Button
                        variante="secondaire"
                        taille="sm"
                        onClick={() => setARejeter(partage)}
                        aria-label={t("rejeterAria", { nom: partage.nomFichier })}
                      >
                        <X size={14} aria-hidden />
                        {tdoc("rejeterPartage")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {requete.data ? (
        <Pagination
          page={page}
          totalPages={requete.data.totalPages}
          totalElements={requete.data.totalElements}
          onChangement={setPage}
        />
      ) : null}

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu?.nomFichier ?? ""}
        obtenir={() => (apercu ? contenuPiece(apercu.documentId) : Promise.reject(new Error("aucune pièce")))}
      />

      <DialogueConfirmation
        ouvert={aValider !== null}
        onFermeture={() => setAValider(null)}
        onConfirmation={() => void valider()}
        titre={tdoc("validerPartage")}
        message={tdoc("partageMessage", { nom: aValider?.nomFichier ?? "" })}
        libelleConfirmation={tdoc("validerPartage")}
        enCours={arbitrer.isPending}
      />

      <ModaleRejetPartage
        piece={aRejeter ? { documentId: aRejeter.documentId, nomFichier: aRejeter.nomFichier } : null}
        onFermeture={() => setARejeter(null)}
      />
    </div>
  );
}
