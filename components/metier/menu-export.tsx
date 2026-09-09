"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { Champ, Select } from "@/components/ui/champ";
import { Button } from "@/components/ui/button";

/**
 * Choix d'un format d'export.
 *
 * Les formats **diffèrent selon l'endpoint** : le calendrier des audiences propose JSON, PDF et
 * Excel ; un rapport y ajoute CSV. Le composant ne présume donc rien et reçoit la liste.
 *
 * `JSON` signifie « à l'écran » : c'est la réponse exploitable par l'interface, les trois autres
 * reviennent en binaire et déclenchent un téléchargement.
 */
export function MenuExport<T extends string>({
  formats,
  valeur,
  onChangement,
  onExport,
  enCours = false,
  id = "format-export",
}: {
  formats: readonly T[];
  valeur: T;
  onChangement: (format: T) => void;
  onExport: () => void;
  enCours?: boolean;
  id?: string;
}) {
  const t = useTranslations("metier");
  const td = useTranslations("domaine");

  return (
    <div className="flex items-end gap-2">
      <Champ id={id} label={t("formatExport")} className="w-40">
        <Select
          id={id}
          value={valeur}
          onChange={(evenement) => onChangement(evenement.target.value as T)}
        >
          {formats.map((format) => (
            <option key={format} value={format}>
              {td(`FormatRapport.${format}` as never)}
            </option>
          ))}
        </Select>
      </Champ>

      <Button onClick={onExport} disabled={enCours}>
        <Download size={14} aria-hidden />
        {t("exporter")}
      </Button>
    </div>
  );
}
