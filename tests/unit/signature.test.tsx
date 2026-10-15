import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MaSignature } from "@/components/modules/compte/ma-signature";
import { rendre as render } from "../utils/rendu";

/**
 * Ma signature enregistrée (N8, métier des 2026-10-03 et 2026-10-06).
 *
 * Ce que ces tests tiennent : l'écran **refuse avant d'envoyer** ce que la lettre ne saurait
 * apposer - un format ou un poids impossibles - et il **dit sa portée**. Un utilisateur qui croirait
 * tenir là une garantie juridique s'appuierait sur du vide, et c'est à l'écran de le dire, pas
 * seulement au code.
 */
/*
 * Un contenu **stable** : TanStack Query rend la meme reference tant qu-il n-a pas refetche, et
 * l-ecran s-appuie dessus pour ne fabriquer qu-une adresse `blob:`. Un mock qui en rendrait un
 * neuf a chaque rendu ferait boucler l-effet sans fin - constate.
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
   * PDFBox lit le PNG et le JPEG. Un PDF déposé ici produirait une lettre **sans** signature, et le
   * défaut ne se verrait qu'à l'impression. L'écran refuse donc avant l'aller-retour - le serveur
   * applique la même règle, il reste l'autorité.
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

  /** L'absence n'est pas une erreur : la lettre part alors avec le nom, à signer à la main. */
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
   * Le point qui compte le plus : l'écran **dit** que cette image n'ajoute aucune valeur juridique.
   * C'est la seule protection contre un utilisateur qui s'appuierait dessus.
   */
  it("annonce que la signature n'ajoute aucune valeur juridique", () => {
    render(<MaSignature />);

    expect(screen.getByText(/n’ajoute aucune valeur juridique/)).toBeInTheDocument();
    expect(screen.getByText(/trace horodatée/)).toBeInTheDocument();
  });

  /** Le retrait est destructif à l'échelle du compte : il se confirme, et la confirmation rassure. */
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
