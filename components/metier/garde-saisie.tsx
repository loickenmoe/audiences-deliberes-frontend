"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { DialogueConfirmation } from "@/components/metier/dialogue-confirmation";

/**
 * Garde contre la perte d'une saisie en cours.
 *
 * **Le défaut qu'elle corrige.** Le formulaire de création de dossier porte la vingtaine de champs
 * du §1189 des spécifications — parties, risque encouru, sensibilité, seuil, affectations, pièces.
 * Un clic sur « Clients » dans la barre latérale effaçait tout, sans un mot. UC-DOS-01 prévoit bien
 * une annulation (« 2-a Annulation : le juriste clique sur *Annuler* »), mais il décrit l'annulation
 * **voulue** ; il ne dit rien de l'annulation **subie**, qui est celle qui coûte.
 *
 * **Deux chemins de sortie, deux mécanismes.** Quitter le site — fermer l'onglet, recharger, saisir
 * une autre adresse — ne peut être intercepté que par `beforeunload`, dont le navigateur impose le
 * dialogue : aucune application ne peut le styler ni en changer le texte. Une navigation **interne**,
 * elle, passe par un lien que l'on peut intercepter avant que le routeur n'agisse ; on pose alors le
 * dialogue de l'application, traduit et cohérent avec le reste.
 *
 * **Ce qui n'est délibérément pas gardé.** L'« Annuler » du formulaire : il exprime une intention
 * explicite, et le doubler d'une confirmation transformerait un geste clair en friction — c'est la
 * distinction d'UC-DOS-01, respectée. Il porte `data-garde-saisie="ignorer"` : sans ce marqueur, le
 * comportement dépendrait de son implémentation — l'écran 06 en fait un lien, les écrans 30 et 33 un
 * bouton — et la garde n'interceptant que les liens, deux formulaires se seraient comportés
 * différemment pour un même geste.
 *
 * **Aucun brouillon persistant.** Conserver la saisie dans le navigateur serait plus confortable,
 * mais y écrirait des données de dossiers sensibles — parties, montants, type de client — sur un
 * poste possiblement partagé, à rebours de la revue de sécurité de F17 qui vérifie qu'aucune donnée
 * ne traîne dans un stockage accessible aux scripts. La garde protège sans rien stocker.
 */
export function GardeSaisie({ actif }: { actif: boolean }) {
  const t = useTranslations("metier");
  const router = useRouter();
  const [cible, setCible] = useState<string | null>(null);
  /** Laisse passer la navigation que l'utilisateur vient de confirmer. */
  const confirmee = useRef(false);

  useEffect(() => {
    if (!actif) return;

    const surFermeture = (evenement: BeforeUnloadEvent) => {
      // `preventDefault` suffit depuis 2023 ; la valeur de retour reste exigée par Safari.
      evenement.preventDefault();
      evenement.returnValue = "";
    };

    window.addEventListener("beforeunload", surFermeture);
    return () => window.removeEventListener("beforeunload", surFermeture);
  }, [actif]);

  useEffect(() => {
    if (!actif) return;

    /**
     * Écoute en phase de **capture** : le gestionnaire du routeur est posé sur le lien lui-même, et
     * ne s'exécute donc qu'après. Intercepter en phase de bouillonnement arriverait trop tard, la
     * navigation étant déjà lancée.
     */
    const surClic = (evenement: MouseEvent) => {
      if (confirmee.current || evenement.defaultPrevented) return;
      // Clic droit, clic du milieu, ou ouverture dans un nouvel onglet : la page reste en place.
      if (evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) {
        return;
      }

      const lien = (evenement.target as Element | null)?.closest?.("a");
      const href = lien?.getAttribute("href");
      if (!lien || !href || href.startsWith("#")) return;
      if (lien.getAttribute("target") === "_blank" || lien.hasAttribute("download")) return;
      if (lien.closest('[data-garde-saisie="ignorer"]')) return;

      const destination = new URL(href, window.location.href);
      // Une autre origine sortira du site : c'est `beforeunload` qui s'en charge, pas ce dialogue.
      if (destination.origin !== window.location.origin) return;
      // Rester sur la même page — une ancre d'onglet, par exemple — ne perd aucune saisie.
      if (destination.pathname === window.location.pathname) return;

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
