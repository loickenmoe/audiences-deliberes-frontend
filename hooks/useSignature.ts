"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { signatureService } from "@/services/signatureService";

/**
 * Ma signature enregistrée (N8).
 *
 * Deux requêtes distinctes, et c'est voulu : l'**état** dit s'il faut proposer un dépôt ou un
 * remplacement, l'**image** ne se charge que pour l'aperçu. Les confondre ferait transiter quelques
 * dizaines de kilo-octets à chaque ouverture de l'écran pour afficher une phrase.
 */
export function useMaSignature() {
  return useQuery({
    queryKey: [CLES.maSignature],
    queryFn: () => signatureService.mienne(),
  });
}

/**
 * L'image, demandée seulement quand il y en a une : sinon le serveur répond 404, à juste titre.
 *
 * Rend le **contenu**, pas une adresse : c'est l'écran qui fabrique l'objet-URL de la vignette et
 * le libère, et `ApercuFichier` fait de même pour le plein format. Mettre une adresse en cache
 * obligerait à choisir entre la révoquer - et servir une adresse morte au retour sur l'écran - ou
 * ne pas la révoquer, et en laisser une derrière chaque remplacement.
 */
export function useMonImageSignature(deposee: boolean) {
  return useQuery({
    queryKey: [CLES.maSignature, "image"],
    queryFn: () => signatureService.monImage(),
    enabled: deposee,
  });
}

/**
 * Déposer et retirer, deux mutations distinctes.
 *
 * Elles invalident l'état **et** l'image : remplacer une signature sans vider l'aperçu laisserait
 * l'ancienne à l'écran, et l'utilisateur croirait son dépôt perdu.
 */
export function useEcritureSignature() {
  const client = useQueryClient();
  const invalider = () => client.invalidateQueries({ queryKey: [CLES.maSignature] });

  const deposer = useMutation({
    mutationFn: (fichier: File) => signatureService.deposer(fichier),
    onSuccess: invalider,
  });
  const retirer = useMutation({
    mutationFn: () => signatureService.retirer(),
    onSuccess: invalider,
  });

  return { deposer, retirer };
}
