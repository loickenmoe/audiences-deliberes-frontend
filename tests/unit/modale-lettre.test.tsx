import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ModaleLettre } from "@/components/modules/constitutions/modale-lettre";
import { ErreurApi } from "@/lib/api/errors";
import type { LettreConstitution } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Representation letter editor: the requester drafts, the SH corrects before signing, a signed
 * letter is read-only. Number segments are edited one by one and stored as one string.
 */
const etat = vi.hoisted(() => ({ lettre: { data: undefined as unknown, isLoading: false } }));
const rediger = vi.hoisted(() => vi.fn());
const demandee = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useConstitutions", () => ({
  useLettreConstitution: (demandeId: number | null) => {
    demandee(demandeId);
    return etat.lettre;
  },
  useRedigerLettre: () => ({ mutateAsync: rediger, isPending: false }),
}));

const toast = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const T = MESSAGES.fr.constitutions;
const C = MESSAGES.fr.commun;

function lettre(partiel: Partial<LettreConstitution>): LettreConstitution {
  return {
    id: 1,
    demandeId: 8,
    numero: null,
    numeroPropose: null,
    suffixeNumero: "First Bank/DAJR/DR",
    lieu: "Yaoundé",
    destinataireNom: null,
    destinataireQualite: null,
    destinataireVille: null,
    concerne: null,
    objet: "Constitution",
    corps: "Maître,",
    signataire: "Le DJ",
    modifiable: true,
    dateGeneration: null,
    dateModification: null,
    redigeParNom: null,
    redigeParProfil: null,
    ...partiel,
  } as LettreConstitution;
}

function dialogue() {
  return screen.getByRole("dialog", { name: T.lettreTitre, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  rediger.mockResolvedValue({});
});

describe("ModaleLettre", () => {
  it("ne charge rien tant qu'elle est fermée, puis attend la lettre", () => {
    etat.lettre = { data: undefined, isLoading: true };
    const { rerender } = rendre(<ModaleLettre demandeId={8} ouvert={false} onFermeture={vi.fn()} />);
    expect(demandee).toHaveBeenLastCalledWith(null);

    rerender(<ModaleLettre demandeId={8} ouvert onFermeture={vi.fn()} />);
    expect(demandee).toHaveBeenLastCalledWith(8);
    expect(within(dialogue()).getByRole("status", { hidden: true })).toBeInTheDocument();
  });

  it("enregistre la lettre complétée, segment par segment", async () => {
    const fermer = vi.fn();
    etat.lettre = { data: lettre({ redigeParNom: "Awa Ndiaye", redigeParProfil: "JURISTE" } as Partial<LettreConstitution>), isLoading: false };
    rendre(<ModaleLettre demandeId={8} ouvert onFermeture={fermer} />);
    const fenetre = dialogue();

    expect(within(fenetre).getByText("Dernière rédaction par Awa Ndiaye")).toBeInTheDocument();
    expect(within(fenetre).getByText(T.lettreNumeroALaSignature)).toBeInTheDocument();
    fireEvent.change(within(fenetre).getByLabelText(T.lettreNumero), { target: { value: "42" } });
    fireEvent.change(within(fenetre).getByLabelText("Segment 2 du numéro"), { target: { value: "DAJ" } });
    for (const [libelle, valeur] of [
      [T.lettreLieu, "Douala"],
      [T.lettreDestinataire, "Me Eto"],
      [T.lettreQualite, "Avocat"],
      [T.lettreVille, "Douala"],
      [T.lettreConcerne, "Dossier X"],
      [T.lettreObjet, "Constitution d'avocat"],
      [T.lettreCorps, "Maître, ..."],
      [T.lettreSignataire, "La DJA"],
    ] as const) {
      // Required fields carry a decorative asterisk in their label: matched on the leading text.
      const champ = within(fenetre).queryByLabelText(libelle) ?? within(fenetre).getByLabelText(new RegExp(`^${libelle}`));
      fireEvent.change(champ, { target: { value: valeur } });
    }
    fireEvent.click(within(fenetre).getByRole("button", { name: T.lettreEnregistrer, hidden: true }));

    await waitFor(() =>
      expect(rediger).toHaveBeenCalledWith({
        demandeId: 8,
        lettre: {
          numero: 42,
          suffixeNumero: "First Bank/DAJ/DR",
          lieu: "Douala",
          destinataireNom: "Me Eto",
          destinataireQualite: "Avocat",
          destinataireVille: "Douala",
          concerne: "Dossier X",
          objet: "Constitution d'avocat",
          corps: "Maître, ...",
          signataire: "La DJA",
        },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(T.lettreEnregistree);
    expect(fermer).toHaveBeenCalled();
  });

  it("efface le numéro imposé quand le champ est vidé", async () => {
    etat.lettre = { data: lettre({ numero: 12 }), isLoading: false };
    rendre(<ModaleLettre demandeId={8} ouvert onFermeture={vi.fn()} />);
    const fenetre = dialogue();
    expect(within(fenetre).getByText(T.lettreNumeroAttribue)).toBeInTheDocument();

    fireEvent.change(within(fenetre).getByLabelText(T.lettreNumero), { target: { value: "" } });
    fireEvent.click(within(fenetre).getByRole("button", { name: T.lettreEnregistrer, hidden: true }));
    await waitFor(() => expect(rediger.mock.calls[0]![0].lettre.numero).toBeNull());
  });

  it("affiche le refus d'enregistrer", async () => {
    rediger.mockRejectedValue(new ErreurApi({ code: "X", message: "Lettre signée" }));
    etat.lettre = { data: lettre({}), isLoading: false };
    rendre(<ModaleLettre demandeId={8} ouvert onFermeture={vi.fn()} />);
    fireEvent.click(within(dialogue()).getByRole("button", { name: T.lettreEnregistrer, hidden: true }));

    expect(await within(dialogue()).findByText("Lettre signée")).toBeInTheDocument();
  });

  it("présente une lettre signée en lecture seule, et la correction du SH", () => {
    etat.lettre = {
      data: lettre({ modifiable: false, redigeParNom: "Chef", redigeParProfil: "SH" } as Partial<LettreConstitution>),
      isLoading: false,
    };
    rendre(<ModaleLettre demandeId={8} ouvert onFermeture={vi.fn()} />);
    const fenetre = dialogue();

    expect(within(fenetre).getByText(T.lettreLectureSeule)).toBeInTheDocument();
    expect(within(fenetre).getByText("Corrigée par le supérieur hiérarchique : Chef")).toBeInTheDocument();
    expect(within(fenetre).getByLabelText(T.lettreLieu)).toBeDisabled();
    expect(within(fenetre).queryByRole("button", { name: T.lettreEnregistrer, hidden: true })).not.toBeInTheDocument();
    expect(within(fenetre).getAllByRole("button", { name: C.fermer, hidden: true }).length).toBeGreaterThan(0);
  });
});
