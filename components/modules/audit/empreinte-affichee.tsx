"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { grouperEmpreinte } from "@/lib/empreinte";

/**
 * A SHA-256 fingerprint displayed for reading and comparison: grouped in blocks of eight characters
 * so it can be compared, with a copy button to avoid retyping errors.
 */
export function EmpreinteAffichee({ empreinte }: Readonly<{ empreinte: string }>) {
  const t = useTranslations("audit");
  const [copiee, setCopiee] = useState(false);

  async function copier() {
    try {
      await navigator.clipboard.writeText(empreinte);
      setCopiee(true);
      // The visual feedback fades: a button that stays "Copied" is misleading.
      setTimeout(() => setCopiee(false), 2_000);
    } catch {
      // Clipboard denied (insecure context, permission): the fingerprint can still be selected
      // manually, an error message would be disproportionate.
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <code
        className="font-mono text-[length:var(--taille-xs)] leading-5 text-texte-secondaire"
        // A fingerprint has no language: declaring it prevents a screen reader from pronouncing it
        // as a word.
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
