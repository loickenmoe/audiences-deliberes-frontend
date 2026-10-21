"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DialogueConfirmation } from "@/components/metier/dialogue-confirmation";

/**
 * Guards against losing unsaved form input when leaving the page.
 * Leaving the site (closing the tab, reloading, typing another address) can only be caught by
 * `beforeunload`, whose dialog is browser-controlled; internal navigation is intercepted on the
 * link before the router acts, and shows the application's own dialog.
 * The form's explicit "Cancel" is not guarded (UC-DOS-01) and carries
 * `data-garde-saisie="ignorer"`.
 * No draft is persisted: storing sensitive case data in the browser on a possibly shared
 * workstation is not acceptable.
 */
export function GardeSaisie({ actif }: Readonly<{ actif: boolean }>) {
  const t = useTranslations("metier");
  const router = useRouter();
  const [cible, setCible] = useState<string | null>(null);
  /** Lets through the navigation the user has just confirmed. */
  const confirmee = useRef(false);

  useEffect(() => {
    if (!actif) return;

    const surFermeture = (evenement: BeforeUnloadEvent) => {
      // `preventDefault` is enough in modern browsers; Safari still requires the return value.
      evenement.preventDefault();
      evenement.returnValue = ""; // NOSONAR - deprecated, but still the only signal Safari honours
    };

    window.addEventListener("beforeunload", surFermeture);
    return () => window.removeEventListener("beforeunload", surFermeture);
  }, [actif]);

  useEffect(() => {
    if (!actif) return;

    /**
     * Listens in the capture phase: the router handler is on the link itself and runs afterwards;
     * intercepting during bubbling would be too late.
     */
    const surClic = (evenement: MouseEvent) => {
      if (confirmee.current || evenement.defaultPrevented) return;
      // Right click, middle click or opening in a new tab: the page stays in place.
      if (evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) {
        return;
      }

      const lien = (evenement.target as Element | null)?.closest?.("a");
      const href = lien?.getAttribute("href");
      if (!lien || !href || href.startsWith("#")) return;
      if (lien.getAttribute("target") === "_blank" || lien.hasAttribute("download")) return;
      if (lien.closest('[data-garde-saisie="ignorer"]')) return;

      const destination = new URL(href, globalThis.location.href);
      // Another origin leaves the site: `beforeunload` handles it, not this dialog.
      if (destination.origin !== globalThis.location.origin) return;
      // Staying on the same page (e.g. a tab anchor) loses no input.
      if (destination.pathname === globalThis.location.pathname) return;

      evenement.preventDefault();
      evenement.stopPropagation();
      setCible(destination.pathname + destination.search);
    };

    document.addEventListener("click", surClic, true);
    return () => document.removeEventListener("click", surClic, true);
  }, [actif]);

  return (
    <DialogueConfirmation
      ouvert={cible !== null}
      onFermeture={() => setCible(null)}
      onConfirmation={() => {
        const destination = cible;
        confirmee.current = true;
        setCible(null);
        if (destination) router.push(destination);
      }}
      titre={t("gardeSaisieTitre")}
      message={t("gardeSaisieMessage")}
      libelleConfirmation={t("gardeSaisieQuitter")}
      destructif
    />
  );
}
