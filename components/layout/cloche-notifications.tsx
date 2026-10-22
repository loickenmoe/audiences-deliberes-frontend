"use client";

import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useNombreNotificationsATraiter } from "@/hooks/useAlertes";

/**
 * Unread notification counter, shown on every authenticated screen.
 *
 * It holds no state of its own: the real-time channel invalidates the cache, the query re-runs and
 * the count follows. A locally incremented badge would diverge as soon as a notification was handled
 * in another tab.
 */
export function ClocheNotifications() {
  const t = useTranslations("notifications");
  const { data: nombre = 0 } = useNombreNotificationsATraiter();

  return (
    <Link
      href="/notifications"
      aria-label={`${t("badge")} - ${t("badgeCompteur", { nombre })}`}
      className="relative inline-flex size-9 items-center justify-center rounded text-texte-secondaire transition-colors hover:bg-surface-attenuee hover:text-texte focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anthracite"
    >
      <BellRing aria-hidden className="size-5" />
      {/*
        Readable brand red (#B3141B, 6.92:1 on white): the "primary action is charcoal" rule targets
        buttons, not a non-clickable indicator whose role is to catch the eye. The number doubles
        the colour, so the badge never informs by colour alone.
      */}
      {nombre > 0 ? (
        <span
          data-testid="compteur-notifications"
          className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-marque-texte px-1 text-center text-[length:var(--taille-2xs)] font-semibold leading-4 text-texte-inverse"
        >
          {nombre > 99 ? "99+" : nombre}
        </span>
      ) : null}
    </Link>
  );
}
