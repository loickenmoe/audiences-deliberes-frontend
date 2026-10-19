"use client";

import { useEffect } from "react";

/**
 * Removes `?motif=…` from the URL once the message is displayed.
 * The logout reason is a one-off event: left in the URL it would survive reload, back navigation,
 * bookmarks and browser tab restore, showing "session expired" again later.
 * `replaceState` rather than the router: `router.replace` would trigger a server render and clear
 * the message just displayed; `replaceState` rewrites the URL without touching the page or adding a
 * history entry.
 */
export function MotifConsomme() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("motif")) return;

    url.searchParams.delete("motif");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  return null;
}
