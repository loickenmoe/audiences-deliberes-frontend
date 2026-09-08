import { getLocale, getTranslations } from "next-intl/server";

import { LANGUES } from "@/i18n/config";
import { changerLangue } from "@/lib/actions/langue";
import { cn } from "@/lib/utils";

/**
 * Bascule entre les deux langues officielles du Cameroun.
 *
 * Deux boutons plutôt qu'une liste déroulante : avec seulement deux choix, la liste ajoute un clic
 * et masque l'option non retenue. La langue active est signalée autrement que par la seule couleur —
 * `aria-current` la porte pour les technologies d'assistance.
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
