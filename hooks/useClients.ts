"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES } from "@/hooks/const";
import { messageErreur } from "@/lib/api/errors";
import { clientService } from "@/services/clientService";
import type { CreerClient } from "@/types/domaine";

export function useClients(params: { nom?: string; reference?: string; page: number; size?: number }) {
  return useQuery({
    queryKey: [CLES.clients, params],
    queryFn: () => clientService.rechercher(params),
    // Garde la page précédente affichée pendant le chargement de la suivante : sans cela, la table
    // clignote entre deux états vides à chaque changement de page.
    placeholderData: (precedent) => precedent,
  });
}

export function useClient(id: number | undefined) {
  return useQuery({
    queryKey: [CLES.client, id],
    queryFn: () => clientService.consulter(id!),
    enabled: id !== undefined,
  });
}

export function useVueClientDossiers(clientId: number | undefined) {
  return useQuery({
    queryKey: [CLES.clientDossiers, clientId],
    queryFn: () => clientService.vueConsolidee(clientId!),
    enabled: clientId !== undefined,
  });
}

export function useCreerClient() {
  const queryClient = useQueryClient();
  const t = useTranslations("clients");

  return useMutation({
    mutationFn: (corps: CreerClient) => clientService.creer(corps),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CLES.clients] });
      toast.success(t("creationReussie"));
    },
    /**
     * Pas de notification d'échec ici : les erreurs de validation se rapportent aux **champs** du
     * formulaire (`appliquerErreurApi`). Un toast en doublon ferait lire deux fois la même chose,
     * et à un endroit qui ne dit pas quoi corriger.
     */
    onError: (erreur) => {
      const message = messageErreur(erreur);
      if (message) console.error("Création de client refusée :", message);
    },
  });
}
