"use client";

import { useTranslations } from "next-intl";

import { EtatVide } from "@/components/global";

/**
 * Le compte est bien celui d'un avocat, mais **aucune fiche du référentiel ne lui est rattachée**
 * (backend Q-107).
 *
 * **Pourquoi un écran dédié plutôt qu'une erreur.** Le portail affichait « Le chargement a échoué »
 * suivi du message du serveur. Or rien n'a échoué : un avocat existe pour le métier parce qu'un
 * juriste l'a inscrit au répertoire avec son identifiant de connexion (RG-INT-01, UC-INT-01), jamais
 * parce qu'il possède un compte. Tant que cette fiche n'existe pas, il n'y a rien à montrer — et
 * l'avocat **n'y peut rien lui-même**. Un message d'échec le laissait devant un texte technique,
 * sans action possible ni interlocuteur.
 *
 * L'écran dit donc trois choses : ce qui manque, que ce n'est pas de son fait, et à qui s'adresser.
 * C'est le même parti que la restriction d'accès d'une publication (ERR-009), présentée comme un
 * état et non comme une panne.
 *
 * **Symétrique de QF-16.** Là, un juriste jamais connecté reste inaffectable ; ici, un avocat jamais
 * inscrit ne voit rien. Dans les deux cas le système a raison — c'est son explication qui manquait.
 */
export function CompteAvocatNonRattache({ titre }: { titre?: string }) {
  const t = useTranslations("portail");

  return (
    <EtatVide
      titre={titre ?? t("compteNonRattacheTitre")}
      description={t("compteNonRattacheTexte")}
    />
  );
}
