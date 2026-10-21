import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * In-app file preview: PDF in a frame, images inline, text as is, `.docx` rendered on demand, and
 * a clear message for formats the browser cannot show. The download keeps the original name.
 */
const telechargerBlob = vi.hoisted(() => vi.fn());
const renderAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/documents", async (original) => ({
  ...(await original<typeof import("@/lib/documents")>()),
  telechargerBlob,
}));
vi.mock("docx-preview", () => ({ renderAsync }));

const D = MESSAGES.fr.documents;

function ouvrir(nomFichier: string, obtenir: () => Promise<Blob>) {
  rendre(<ApercuFichier ouvert onFermeture={vi.fn()} nomFichier={nomFichier} obtenir={obtenir} />);
  return screen.getByRole("dialog", { name: `Aperçu - ${nomFichier}`, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  renderAsync.mockResolvedValue(undefined);
});

describe("ApercuFichier", () => {
  it("ne charge rien tant qu'il est fermé", () => {
    const obtenir = vi.fn();
    rendre(<ApercuFichier ouvert={false} onFermeture={vi.fn()} nomFichier="a.pdf" obtenir={obtenir} />);
    expect(obtenir).not.toHaveBeenCalled();
  });

  it("montre un PDF dans un cadre et le télécharge sous son nom", async () => {
    const contenu = new Blob(["%PDF"]);
    const fenetre = ouvrir("acte.pdf", () => Promise.resolve(contenu));
    expect(within(fenetre).getByRole("status", { hidden: true })).toBeInTheDocument();

    expect(await within(fenetre).findByTitle("acte.pdf")).toHaveAttribute("src", expect.stringMatching(/^blob:/));
    fireEvent.click(within(fenetre).getByRole("button", { name: D.telecharger, hidden: true }));
    expect(telechargerBlob).toHaveBeenCalledWith(contenu, "acte.pdf");
  });

  it("affiche une image", async () => {
    const fenetre = ouvrir("photo.JPG", () => Promise.resolve(new Blob(["x"])));
    expect(await within(fenetre).findByRole("img", { name: "photo.JPG", hidden: true })).toBeInTheDocument();
  });

  it("affiche le contenu d'un fichier texte", async () => {
    // jsdom's Blob has no `text()`: the content is provided as the browser would read it.
    const contenu = Object.assign(new Blob(["Bonjour"]), { text: () => Promise.resolve("Bonjour") });
    const fenetre = ouvrir("note.txt", () => Promise.resolve(contenu));
    expect(await within(fenetre).findByText("Bonjour")).toBeInTheDocument();
  });

  it("rend un document Word, ou dit qu'il n'a pas pu l'afficher", async () => {
    let fenetre = ouvrir("memoire.docx", () => Promise.resolve(new Blob(["x"])));
    await waitFor(() => expect(renderAsync).toHaveBeenCalled());
    await waitFor(() => expect(within(fenetre).queryByRole("status", { hidden: true })).not.toBeInTheDocument());

    renderAsync.mockRejectedValueOnce(new Error("illisible"));
    fenetre = ouvrir("autre.docx", () => Promise.resolve(new Blob(["x"])));
    expect(await within(fenetre).findByText(D.apercuWordErreur)).toBeInTheDocument();
  });

  it("explique l'ancien format Word et les formats sans aperçu", async () => {
    let fenetre = ouvrir("vieux.doc", () => Promise.resolve(new Blob(["x"])));
    expect(await within(fenetre).findByText(D.apercuWordAncien)).toBeInTheDocument();

    fenetre = ouvrir("tableau.xlsx", () => Promise.resolve(new Blob(["x"])));
    expect(await within(fenetre).findByText(D.apercuImpossible)).toBeInTheDocument();
  });

  it("signale un document qui n'a pas pu être chargé", async () => {
    const fenetre = ouvrir("acte.pdf", () => Promise.reject(new Error("réseau")));
    expect(await within(fenetre).findByText(D.apercuErreur)).toBeInTheDocument();
    expect(within(fenetre).getByRole("button", { name: D.telecharger, hidden: true })).toBeDisabled();
  });
});
