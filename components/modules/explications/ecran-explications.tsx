"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FileExplications } from "@/components/modules/explications/file-explications";
import { ModaleDemandeExplication } from "@/components/modules/explications/modale-demande-explication";
import { peut } from "@/lib/rbac";

/**
 * Écran 47 — les demandes d'explication (N7 temps 2, observation 8).
 *
 * **Le même écran, lu des deux bouts.** La direction écrit et relit ; l'avocat répond. Le bouton
 * d'écriture n'apparaît que pour celle qui écrit, mais la liste est la même composante : deux
 * écrans auraient fini par compter différemment la même chose.
 */
export function EcranExplications({ roles }: { roles: string[] }) {
  const t = useTranslations("explications");
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-xl)] font-semibold">{t("titre")}</h1>
          <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
            {t("description")}
          </p>
        </div>
        {peut(roles, "demanderExplication") ? (
          <Button onClick={() => setOuvert(true)}>
            <Plus size={15} aria-hidden />
            {t("demander")}
          </Button>
        ) : null}
      </header>

      <FileExplications roles={roles} />

      <ModaleDemandeExplication ouvert={ouvert} onFermeture={() => setOuvert(false)} />
    </div>
  );
}
