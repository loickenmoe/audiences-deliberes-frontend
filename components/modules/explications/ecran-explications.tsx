"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FileExplications } from "@/components/modules/explications/file-explications";
import { ModaleDemandeExplication } from "@/components/modules/explications/modale-demande-explication";
import { peut } from "@/lib/rbac";

/**
 * Screen 47 - explanation requests. Management writes and reviews them; the lawyer answers.
 * Only the writing button depends on the profile: both sides share the same list component so
 * they never count the same thing differently.
 */
export function EcranExplications({ roles }: Readonly<{ roles: string[] }>) {
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
