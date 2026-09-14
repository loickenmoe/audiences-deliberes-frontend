"use client";

import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { useNombreNotificationsATraiter } from "@/hooks/useAlertes";

/**
 * Compteur de notifications non lues, présent sur tous les écrans authentifiés.
 *
 * Il ne tient aucun état propre : le canal temps réel invalide le cache, la requête se rejoue, le
 * nombre suit. Une pastille locale incrémentée à la main divergerait dès la première notification
 * traitée depuis un autre onglet.
 */
export function ClocheNotifications() {
  const t = useTranslations("notifications");
  const { data: nombre = 0 } = useNombreNotificationsATraiter();

  return (
    <Link
      href="/notifications"
      aria-label={`${t("badge")} — ${t("badgeCompteur", { nombre })}`}
      className="relative inline-flex size-9 items-center justify-center rounded text-texte-secondaire transition-colors hover:bg-surface-attenuee hover:text-texte focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anthracite"
    >
      <BellRing aria-hidden className="size-5" />
      {/*
        Rouge de marque lisible (#B3141B, 6,92:1 sur blanc) : la règle « l'action principale est
        anthracite » vise les boutons, pas un indicateur non cliquable dont c'est précisément le
        rôle d'attirer l'œil. Le nombre double la couleur — la pastille n'informe jamais seule.
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
