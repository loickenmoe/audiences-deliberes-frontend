import { getLocale, getTranslations } from "next-intl/server";

import { LANGUES } from "@/i18n/config";
import { changerLangue } from "@/lib/actions/langue";
import { cn } from "@/lib/utils";

/**
 * Switches between Cameroon's two official languages.
 *
 * Two buttons rather than a dropdown: with only two choices, a list adds a click and hides the other
 * option. The active language is not signalled by colour alone: `aria-current` carries it for
 * assistive technologies.
 */
export async function SelecteurLangue({ className }: { className?: string }) {
  const active = await getLocale();
  const t = await getTranslations("commun");

  return (
    <form
      action={changerLangue}
      aria-label={t("langue")}
      className={cn(
        "flex items-center overflow-hidden rounded border border-bordure-forte",
        className,
      )}
    >
      {LANGUES.map((langue) => {
        const courante = langue === active;
        return (
          <button
            key={langue}
            type="submit"
            name="langue"
            value={langue}
            aria-current={courante ? "true" : undefined}
            className={cn(
              "px-2.5 py-1 text-[length:var(--taille-xs)] font-medium uppercase transition-colors",
              courante
                ? "bg-anthracite text-texte-inverse"
                : "bg-surface text-texte-secondaire hover:bg-surface-attenuee",
            )}
          >
            {langue}
          </button>
        );
      })}
    </form>
  );
}
