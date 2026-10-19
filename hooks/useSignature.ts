"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLES } from "@/hooks/const";
import { signatureService } from "@/services/signatureService";

/**
 * The current user's stored signature. State and image are deliberately separate queries: the
 * state decides between upload and replace, the image is only loaded for the preview.
 */
export function useMaSignature() {
  return useQuery({
    queryKey: [CLES.maSignature],
    queryFn: () => signatureService.mienne(),
  });
}

/**
 * The image, fetched only when one exists (otherwise 404). Returns the content, not an object URL:
 * the screen creates and revokes its own URLs, since a cached URL would either be dead after
 * revocation or leak on each replacement.
 */
export function useMonImageSignature(deposee: boolean) {
  return useQuery({
    queryKey: [CLES.maSignature, "image"],
    queryFn: () => signatureService.monImage(),
    enabled: deposee,
  });
}

/**
 * Upload and remove mutations. Both invalidate state and image, so a replaced signature never
 * leaves the old preview on screen.
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
