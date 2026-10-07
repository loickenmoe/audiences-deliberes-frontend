"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { demandeExplicationService } from "@/services/demandeExplicationService";

/**
 * Les demandes d'explication (N7 temps 2).
 *
 * La même requête sert la direction et l'avocat : le serveur décide du périmètre sur l'identité de
 * qui appelle. L'écran n'a donc rien à filtrer, et rien à savoir de l'autre public.
 */
export function useDemandesExplication(enAttente: boolean, page: number) {
  return useQuery({
    queryKey: [CLES.demandesExplication, { enAttente, page }],
    queryFn: () => demandeExplicationService.lister(enAttente, page),
  });
}

/**
 * Écrire et répondre, deux mutations distinctes.
 *
 * Les deux invalident la même clé : une demande qui part ou une réponse qui arrive change la file
 * des deux côtés, et laisser l'un des deux écrans sur son ancienne vue ferait croire qu'il ne s'est
 * rien passé.
 */
export function useEcritureExplication() {
  const client = useQueryClient();
  const invalider = () => client.invalidateQueries({ queryKey: [CLES.demandesExplication] });

  const demander = useMutation({
    mutationFn: demandeExplicationService.demander,
    onSuccess: invalider,
  });
  const repondre = useMutation({
    mutationFn: ({ id, reponse }: { id: number; reponse: string }) =>
      demandeExplicationService.repondre(id, reponse),
    onSuccess: invalider,
  });

  return { demander, repondre };
}
