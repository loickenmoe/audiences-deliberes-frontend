"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { attendreLecturesEnCours, verrouillerJeton } from "@/lib/cache-jeton";

/**
 * Bouton de déconnexion.
 *
 * Le POST vers `/api/deconnexion` reste un envoi de formulaire natif — c'est lui qui révoque le
 * jeton chez Keycloak puis efface le cookie (voir `app/api/deconnexion/route.ts`). Ce composant
 * n'ajoute que ce qui doit se passer **avant** ce POST.
 *
 * **Pourquoi retarder l'envoi** (QF-42) : toute lecture de `/api/auth/session` **repose** le cookie
 * de session. Une lecture partie juste avant la déconnexion revient juste après et ressuscite le
 * cookie que celle-ci vient d'effacer — la session reste alors ouverte, et l'utilisateur qui se
 * croit déconnecté ne l'est pas. Verrouiller le cache empêche les lectures suivantes ; il faut
 * encore **attendre celle qui est déjà en vol**. Les deux gestes réunis rendent la déconnexion
 * déterministe : après le POST, plus rien ne peut reposer le cookie.
 *
 * L'attente est de l'ordre de la centaine de millisecondes ; le bouton se désactive pendant ce
 * temps, pour qu'un double clic ne parte pas en double POST.
 */
export function BoutonDeconnexion({ libelle }: { libelle: string }) {
  const [enCours, setEnCours] = useState(false);

  async function deconnecter(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    // `currentTarget` est nul après le premier `await` : on retient le formulaire tout de suite.
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
