"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { DateValeur } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Button } from "@/components/ui/button";
import { gedService } from "@/services/gedService";
import type { Jurisprudence } from "@/types/domaine";

/**
 * Lignes de jurisprudences, partagées par la base (38) et la fiche (14). L'URL de téléchargement ne
 * vit que 10 minutes : on la redemande au moment d'ouvrir (`rafraichir`), jamais celle de l'affichage.
 */
export function ListeJurisprudences({
  jurisprudences,
  avecDossier,
  rafraichir,
}: {
  jurisprudences: Jurisprudence[];
  avecDossier: boolean;
  rafraichir: () => Promise<Jurisprudence[]>;
}) {
  const t = useTranslations("jurisprudence");
  const td = useTranslations("domaine");
  const [apercu, setApercu] = useState<Jurisprudence | null>(null);

  async function contenu(id: number): Promise<Blob> {
    const fraiche = (await rafraichir()).find((j) => j.id === id);
    if (!fraiche?.urlTelechargement) throw new Error("URL de téléchargement absente");
    return gedService.recupererContenu(fraiche.urlTelechargement);
  }

  return (
    <>
      <div className="overflow-x-auto rounded border border-bordure bg-surface">
        <table className="w-full text-left text-[length:var(--taille-sm)]">
          <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">{t("colonneDecision")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("colonneNature")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("colonneArchive")}</th>
              <th scope="col" className="px-4 py-2 font-medium">{t("colonneMotsCles")}</th>
              {avecDossier ? <th scope="col" className="px-4 py-2 font-medium">{t("colonneDossier")}</th> : null}
              <th scope="col" className="px-4 py-2 font-medium">
                <span className="sr-only">{t("colonneActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure">
            {jurisprudences.map((j) => (
              <tr key={j.id}>
                <td className="px-4 py-2">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{j.juridiction}</span>
                    <span className="text-[length:var(--taille-xs)] text-texte-tertiaire"><DateValeur valeur={j.dateDecision} /></span>
                  </span>
                </td>
                <td className="px-4 py-2">{j.natureDecision}</td>
                <td className="px-4 py-2">{td(`TypeArchiveJurisprudence.${j.typeArchive}` as never)}</td>
                <td className="px-4 py-2">
                  <ul className="flex flex-wrap gap-1">
                    {j.motsCles.map((motCle) => (
                      <li key={motCle} className="rounded-sm border border-bordure-forte px-1.5 py-0.5 text-[length:var(--taille-xs)]">
                        {motCle}
                      </li>
                    ))}
                  </ul>
                </td>
                {avecDossier ? (
                  <td className="px-4 py-2">
                    {j.dossierId !== null ? (
                      <Link href={`/dossiers/${j.dossierId}`} className="underline underline-offset-4">{t("voirDossier")}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                <td className="px-4 py-2">
                  <div className="flex justify-end">
                    <Button
                      variante="secondaire"
                      taille="sm"
                      onClick={() => setApercu(j)}
                      aria-label={t("consulterAria", { nature: j.natureDecision, juridiction: j.juridiction })}
                    >
                      <Eye size={14} aria-hidden />
                      {t("consulter")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ApercuFichier
        ouvert={apercu !== null}
        onFermeture={() => setApercu(null)}
        nomFichier={apercu ? `${apercu.natureDecision}-${apercu.dateDecision}.pdf` : ""}
        obtenir={() => (apercu ? contenu(apercu.id) : Promise.reject(new Error("aucune décision")))}
      />
    </>
  );
}
