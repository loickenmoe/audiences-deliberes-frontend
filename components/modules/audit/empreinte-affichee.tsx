"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { grouperEmpreinte } from "@/lib/empreinte";

/**
 * Une empreinte SHA-256, présentée pour être lue et comparée (backend Q-114).
 *
 * **Le défaut qu'elle corrige.** Affichée d'un seul tenant, une empreinte de soixante-quatre
 * caractères est illisible : personne ne la compare, et une valeur que nul ne vérifie n'est qu'une
 * décoration. Groupée par blocs de huit, elle se compare — on lit les premiers blocs, puis les
 * derniers, comme on le fait d'une clé GPG ou d'un numéro de compte.
 *
 * **Le bouton de copie n'est pas un ornement** : recopier soixante-quatre caractères à la main est
 * la façon la plus sûre d'introduire l'erreur qu'on cherchait à écarter.
 */
export function EmpreinteAffichee({ empreinte }: { empreinte: string }) {
  const t = useTranslations("audit");
  const [copiee, setCopiee] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(empreinte);
      setCopiee(true);
      // Le retour visuel s'efface : un bouton qui reste « Copié » ment dès la seconde suivante.
      setTimeout(() => setCopiee(false), 2_000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : l'empreinte reste sélectionnable
      // à la main. Un message d'erreur pour un geste de confort serait disproportionné.
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <code
        className="font-mono text-[length:var(--taille-xs)] leading-5 text-texte-secondaire"
        // Une empreinte n'est d'aucune langue : l'annoncer évite qu'un lecteur d'écran tente de la
        // prononcer comme un mot.
        lang="zxx"
      >
        {grouperEmpreinte(empreinte).map((ligne) => (
          <span key={ligne} className="block">
            {ligne}
          </span>
        ))}
      </code>
      <Button variante="discrete" taille="sm" onClick={() => void copier()}>
        {copiee ? t("empreinteCopiee") : t("copierEmpreinte")}
      </Button>
    </span>
  );
}
