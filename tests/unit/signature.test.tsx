import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MaSignature } from "@/components/modules/compte/ma-signature";
import { rendre as render } from "../utils/rendu";

/**
 * My saved signature (N8). The screen **refuses before sending** what the letter cannot embed
 * (unsupported format or size) and **states its scope**: the image carries no legal guarantee.
 */
/*
 * **Stable** content: TanStack Query returns the same reference until it refetches, and the screen
 * relies on that to create a single `blob:` URL. A mock returning a new one on each render would
 * make the effect loop forever.
 */
const IMAGE = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

const deposer = vi.fn();
const retirer = vi.fn();
let etat: { deposee: boolean; type: string | null; deposeeLe: string | null } = {
  deposee: false,
  type: null,
  deposeeLe: null,
};

vi.mock("@/hooks/useSignature", () => ({
  useMaSignature: () => ({ data: etat, isLoading: false, error: null }),
  useMonImageSignature: () => ({ data: IMAGE }),
  useEcritureSignature: () => ({
    deposer: { mutateAsync: deposer, isPending: false },
    retirer: { mutateAsync: retirer, isPending: false },
  }),
}));

function fichier(nom: string, type: string, octets: number) {
  return new File([new Uint8Array(octets)], nom, { type });
}

beforeEach(() => {
  deposer.mockReset().mockResolvedValue(etat);
  retirer.mockReset().mockResolvedValue(undefined);
  etat = { deposee: false, type: null, deposeeLe: null };
});

describe("MaSignature", () => {
  it("dépose un PNG et l'envoie au serveur", async () => {
    render(<MaSignature />);

    const champ = screen.getByLabelText(/Déposer ma signature/);
    await userEvent.upload(champ, fichier("sig.png", "image/png", 10));

    await waitFor(() => expect(deposer).toHaveBeenCalledTimes(1));
    expect((deposer.mock.calls[0]?.[0] as File).name).toBe("sig.png");
  });

  /**
   * PDFBox reads PNG and JPEG. A PDF here would produce a letter **without** a signature, noticed
   * only when printed. The screen refuses before the round trip; the server enforces the same rule.
   */
  it("refuse un format que la lettre ne saurait apposer, sans appeler le serveur", async () => {
    render(<MaSignature />);

    const champ = screen.getByLabelText(/Déposer ma signature/);
    await userEvent.upload(champ, fichier("sig.pdf", "application/pdf", 10));

    await waitFor(() => expect(deposer).not.toHaveBeenCalled());
  });

  it("refuse une image de plus de 200 Ko, sans appeler le serveur", async () => {
    render(<MaSignature />);

    const champ = screen.getByLabelText(/Déposer ma signature/);
    await userEvent.upload(champ, fichier("sig.png", "image/png", 200_001));

    await waitFor(() => expect(deposer).not.toHaveBeenCalled());
  });

  /** No signature is not an error: the letter then carries the name, to be signed by hand. */
  it("explique ce qui se passe quand rien n'est déposé", () => {
    render(<MaSignature />);

    expect(screen.getByText(/Aucune signature déposée/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirer" })).not.toBeInTheDocument();
  });

  it("propose le remplacement et le retrait une fois la signature déposée", () => {
    etat = { deposee: true, type: "image/png", deposeeLe: "2026-10-06T10:00:00" };
    render(<MaSignature />);

    expect(screen.getByLabelText(/Remplacer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirer" })).toBeInTheDocument();
    expect(screen.getByAltText("Aperçu de ma signature")).toBeInTheDocument();
  });

  /**
   * The screen **states** that this image adds no legal value, the only protection against a user
   * relying on it.
   */
  it("annonce que la signature n'ajoute aucune valeur juridique", () => {
    render(<MaSignature />);

    expect(screen.getByText(/n’ajoute aucune valeur juridique/)).toBeInTheDocument();
    expect(screen.getByText(/trace horodatée/)).toBeInTheDocument();
  });

  /** Removal is destructive for the account: it requires confirmation. */
  it("confirme le retrait en disant ce qu'il ne détruit pas", async () => {
    etat = { deposee: true, type: "image/png", deposeeLe: "2026-10-06T10:00:00" };
    render(<MaSignature />);

    await userEvent.click(screen.getByRole("button", { name: "Retirer" }));

    expect(await screen.findByText(/Les lettres déjà signées ne changent pas/)).toBeInTheDocument();
    expect(retirer).not.toHaveBeenCalled();
  });

  it("traduit l'écran", () => {
    render(<MaSignature />, { langue: "en" });

    expect(screen.getByText("My signature")).toBeInTheDocument();
    expect(screen.getByText(/adds no legal weight/)).toBeInTheDocument();
  });
});
