"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { attendreLecturesEnCours, verrouillerJeton } from "@/lib/cache-jeton";

/**
 * Logout button.
 *
 * The POST to `/api/deconnexion` stays a native form submission: it revokes the token at Keycloak,
 * then clears the cookie (see `app/api/deconnexion/route.ts`). This component only adds what must
 * happen **before** that POST.
 *
 * Why delay the submission: every read of `/api/auth/session` **re-sets** the session cookie. A read
 * started just before logout could return just after and revive the cleared cookie, leaving the user
 * logged in. Locking the cache blocks further reads; we must also **wait for the one already in
 * flight**. Together this makes logout deterministic. The wait is ~100 ms; the button is disabled
 * meanwhile so a double click does not send two POSTs.
 */
export function BoutonDeconnexion({ libelle }: Readonly<{ libelle: string }>) {
  const [enCours, setEnCours] = useState(false);

  async function deconnecter(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    // `currentTarget` is null after the first `await`: capture the form right away.
    const formulaire = evenement.currentTarget;
    setEnCours(true);
    verrouillerJeton();
    await attendreLecturesEnCours();
    formulaire.submit();
  }

  return (
    <form action="/api/deconnexion" method="post" onSubmit={deconnecter}>
      <Button type="submit" variante="secondaire" taille="sm" disabled={enCours}>
        <LogOut size={14} aria-hidden />
        {libelle}
      </Button>
    </form>
  );
}
