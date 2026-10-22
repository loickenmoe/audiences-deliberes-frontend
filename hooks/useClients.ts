"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CLES } from "@/hooks/const";
import { messageErreur } from "@/lib/api/errors";
import { clientService } from "@/services/clientService";
import type { CreerClient, ModifierClient } from "@/types/domaine";

export function useClients(params: { nom?: string; reference?: string; page: number; size?: number }) {
  return useQuery({
    queryKey: [CLES.clients, params],
    queryFn: () => clientService.rechercher(params),
    // Keep the previous page displayed while the next one loads, so the table does not flicker.
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
     * No failure toast: validation errors are attached to the form fields (`appliquerErreurApi`),
     * and a duplicate toast would not say what to fix.
     */
    onError: (erreur) => {
      const message = messageErreur(erreur);
      if (message) console.error("Création de client refusée :", message);
    },
  });
}

export function useModifierClient(id: number) {
  const queryClient = useQueryClient();
  const t = useTranslations("clients");

  return useMutation({
    mutationFn: (corps: ModifierClient) => clientService.modifier(id, corps),
    onSuccess: () => {
      // Both the record and the list display the name, so both caches are stale.
      void queryClient.invalidateQueries({ queryKey: [CLES.client, id] });
      void queryClient.invalidateQueries({ queryKey: [CLES.clients] });
      toast.success(t("modificationReussie"));
    },
    // Same as creation: the error goes to the field, not to a duplicate toast.
    onError: (erreur) => {
      const message = messageErreur(erreur);
      if (message) console.error("Modification de client refusée :", message);
    },
  });
}
