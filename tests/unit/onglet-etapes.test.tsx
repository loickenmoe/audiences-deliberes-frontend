import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OngletEtapes } from "@/components/modules/dossiers/onglet-etapes";
import { ErreurApi } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";
import { MESSAGES, rendre } from "../utils/rendu";

/**
 * Screen 08 - procedure steps: only accepted transitions are offered, and the backend's silent side
 * effects (opening the next step on an appeal, creating intermediate steps) are announced first.
 */
const mutations = vi.hoisted(() => ({ modifier: vi.fn(), creer: vi.fn() }));
vi.mock("@/hooks/useDossiers", () => ({
  useModifierStatutEtape: () => ({ mutateAsync: mutations.modifier, isPending: false }),
  useCreerEtape: () => ({ mutateAsync: mutations.creer, isPending: false }),
}));

const F = MESSAGES.fr.fiche;
const SC = MESSAGES.fr.domaine.StatutCycleVie;
const TE = MESSAGES.fr.domaine.TypeEtape;
const JURISTE = ["ROLE_JURISTE", "ROLE_CONSULTATION"];

function dossier(etapes: { id: number; type: string; statutCycleVie: string }[]): Dossier {
  return { id: 3, etapes } as unknown as Dossier;
}

function confirmation(titre: string) {
  return screen.getByRole("dialog", { name: titre, hidden: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  mutations.modifier.mockResolvedValue({});
  mutations.creer.mockResolvedValue({});
});

describe("OngletEtapes - lecture", () => {
  it("prévient qu'un non-juriste ne fait que lire, et dit quand il n'y a aucune étape", () => {
    rendre(<OngletEtapes dossier={dossier([])} roles={["ROLE_CONSULTATION"]} />);

    expect(screen.getByText(F.lectureSeuleEtapes)).toBeInTheDocument();
    expect(screen.getByText(F.etapesAucune)).toBeInTheDocument();
    expect(screen.queryByText(F.positionnerTitre)).not.toBeInTheDocument();
  });

  it("range les étapes dans l'ordre de la procédure", () => {
    rendre(
      <OngletEtapes
        dossier={dossier([
          { id: 2, type: "RECOURS_1", statutCycleVie: "OUVERTURE" },
          { id: 1, type: "INSTANCE", statutCycleVie: "CLOTURE" },
        ])}
        roles={["ROLE_CONSULTATION"]}
      />,
    );

    const titres = screen.getAllByText(new RegExp(`^(${TE.INSTANCE}|${TE.RECOURS_1})$`)).map((titre) => titre.textContent);
    expect(titres).toEqual([TE.INSTANCE, TE.RECOURS_1]);
  });

  it("renvoie aux délibérés une étape en délibéré, et dit qu'une étape archivée n'a plus de transition", () => {
    rendre(
      <OngletEtapes
        dossier={dossier([
          { id: 1, type: "INSTANCE", statutCycleVie: "EN_DELIBERE" },
          { id: 2, type: "RECOURS_1", statutCycleVie: "ARCHIVE" },
        ])}
        roles={JURISTE}
      />,
    );

    expect(screen.getByText(F.aideEnDelibere)).toBeInTheDocument();
    expect(screen.getByText(F.aucuneTransition)).toBeInTheDocument();
  });
});

describe("OngletEtapes - transitions", () => {
  it("n'offre que les transitions acceptées et applique la transition choisie", async () => {
    rendre(<OngletEtapes dossier={dossier([{ id: 1, type: "INSTANCE", statutCycleVie: "OUVERTURE" }])} roles={JURISTE} />);
    const champ = screen.getByLabelText(F.changerStatut);

    expect(within(champ).getAllByRole("option").map((option) => option.textContent)).toEqual([F.choisirStatut, SC.EN_COURS]);
    expect(screen.getByRole("button", { name: F.appliquer })).toBeDisabled();

    fireEvent.change(champ, { target: { value: "EN_COURS" } });
    fireEvent.click(screen.getByRole("button", { name: F.appliquer }));

    await waitFor(() => expect(mutations.modifier).toHaveBeenCalledWith({ etapeId: 1, nouveauStatut: "EN_COURS" }));
  });

  it("fait confirmer l'exercice d'un recours avant de rouvrir l'étape", async () => {
    rendre(<OngletEtapes dossier={dossier([{ id: 1, type: "INSTANCE", statutCycleVie: "DELIBERE_VIDE" }])} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText(F.changerStatut), { target: { value: "EN_COURS" } });
    fireEvent.click(screen.getByRole("button", { name: F.appliquer }));

    expect(mutations.modifier).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation(F.confirmerRecoursTitre)).getByRole("button", { name: MESSAGES.fr.metier.confirmer, hidden: true }));
    await waitFor(() => expect(mutations.modifier).toHaveBeenCalledWith({ etapeId: 1, nouveauStatut: "EN_COURS" }));
  });

  it("clôture sans confirmation et affiche le refus du serveur près du contrôle", async () => {
    mutations.modifier.mockRejectedValue(new ErreurApi({ code: "ERR-004", message: "Transition refusée" }));
    rendre(<OngletEtapes dossier={dossier([{ id: 1, type: "INSTANCE", statutCycleVie: "DELIBERE_VIDE" }])} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText(F.changerStatut), { target: { value: "CLOTURE" } });
    fireEvent.click(screen.getByRole("button", { name: F.appliquer }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Transition refusée");
  });
});

describe("OngletEtapes - positionnement", () => {
  it("positionne directement une étape sans intermédiaire manquant", async () => {
    rendre(<OngletEtapes dossier={dossier([{ id: 1, type: "INSTANCE", statutCycleVie: "CLOTURE" }])} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText(F.choisirEtape), { target: { value: "RECOURS_1" } });
    fireEvent.click(screen.getByRole("button", { name: F.positionner }));

    await waitFor(() => expect(mutations.creer).toHaveBeenCalledWith("RECOURS_1"));
  });

  it("annonce les étapes intermédiaires qui seront créées", async () => {
    rendre(<OngletEtapes dossier={dossier([])} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText(F.choisirEtape), { target: { value: "RECOURS_2" } });
    fireEvent.click(screen.getByRole("button", { name: F.positionner }));

    const modale = confirmation(F.confirmerPositionnementTitre);
    expect(within(modale).getByText(`Positionner le dossier à l’étape « ${TE.RECOURS_2} » créera aussi : ${TE.INSTANCE}, ${TE.RECOURS_1}, au statut Ouverture.`)).toBeInTheDocument();
    fireEvent.click(within(modale).getByRole("button", { name: MESSAGES.fr.metier.confirmer, hidden: true }));
    await waitFor(() => expect(mutations.creer).toHaveBeenCalledWith("RECOURS_2"));
  });

  it("affiche le refus de positionner", async () => {
    mutations.creer.mockRejectedValue(new ErreurApi({ code: "X", message: "Étape existante" }));
    rendre(<OngletEtapes dossier={dossier([{ id: 1, type: "INSTANCE", statutCycleVie: "CLOTURE" }])} roles={JURISTE} />);
    fireEvent.change(screen.getByLabelText(F.choisirEtape), { target: { value: "RECOURS_1" } });
    fireEvent.click(screen.getByRole("button", { name: F.positionner }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Étape existante");
  });

  it("dit quand toutes les étapes existent", () => {
    rendre(
      <OngletEtapes
        dossier={dossier([
          { id: 1, type: "INSTANCE", statutCycleVie: "CLOTURE" },
          { id: 2, type: "RECOURS_1", statutCycleVie: "CLOTURE" },
          { id: 3, type: "RECOURS_2", statutCycleVie: "OUVERTURE" },
          { id: 4, type: "RECOURS_2_CCJA", statutCycleVie: "OUVERTURE" },
        ])}
        roles={JURISTE}
      />,
    );

    expect(screen.getByText(F.toutesEtapesCreees)).toBeInTheDocument();
  });
});
