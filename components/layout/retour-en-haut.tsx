"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Scrolls the content back to the top on every screen change.
 *
 * Next resets the **window** on route change, but on large screens the content container is what
 * scrolls, so without this a new screen would open already scrolled to the previous position.
 *
 * Table pagination is deliberately unaffected: it navigates with `scroll: false`, and this component
 * only listens to the **pathname**, not query parameters (page, filter, size).
 */
export function RetourEnHaut() {
  const chemin = usePathname();

  useEffect(() => {
    document.getElementById("contenu-principal")?.scrollTo({ top: 0 });
  }, [chemin]);

  return null;
}
