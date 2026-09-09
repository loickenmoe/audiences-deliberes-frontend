import type { ColumnDef } from "@tanstack/react-table";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CycleEtape } from "@/components/metier/cycle-etape";
import { DialogueConfirmation } from "@/components/metier/dialogue-confirmation";
import { Pagination } from "@/components/metier/pagination";
import { TableDonnees } from "@/components/metier/table-donnees";
import { Televersement } from "@/components/metier/televersement";
import { MontantFcfa, PoidsFichier } from "@/components/metier/valeurs";
import { ErreurApi } from "@/lib/api/errors";
import { rendre as render } from "../utils/rendu";

describe("CycleEtape", () => {
  /**
   * L'étape courante ne doit pas être signalée par la seule couleur : un utilisateur daltonien, et
   * un lecteur d'écran, doivent la percevoir aussi.
   */
  it("marque l'étape courante par aria-current", () => {
    render(<CycleEtape statut="EN_DELIBERE" />);

    const courante = screen.getByText("En délibéré", { selector: "span[aria-current]" });
    expect(courante).toHaveAttribute("aria-current", "step");
  });

  it("affiche les six états du cycle de vie", () => {
    render(<CycleEtape statut="EN_COURS" />);

    for (const libelle of [
      "Ouverture",
      "En cours",
      "En délibéré",
      "Délibéré vidé",
      "Clôturée",
      "Archivée",
    ]) {
      expect(screen.getByText(libelle)).toBeInTheDocument();
    }
  });

  /** La boucle de prorogation est invisible sur une frise linéaire : il faut la dire. */
  it("annonce les prorogations et le rabattement possible en délibéré", () => {
    render(<CycleEtape statut="EN_DELIBERE" nbProrogations={11} />);

    expect(screen.getByText("11 prorogations")).toBeInTheDocument();
    expect(screen.getByText("Rabattement possible")).toBeInTheDocument();
  });

  it("n'annonce pas de rabattement hors du délibéré", () => {
    render(<CycleEtape statut="CLOTURE" />);
    expect(screen.queryByText("Rabattement possible")).not.toBeInTheDocument();
  });

  it("accorde le pluriel des prorogations", () => {
    const { unmount } = render(<CycleEtape statut="EN_DELIBERE" nbProrogations={1} />);
    expect(screen.getByText("1 prorogation")).toBeInTheDocument();
    unmount();

    render(<CycleEtape statut="EN_DELIBERE" nbProrogations={1} />, { langue: "en" });
    expect(screen.getByText("1 extension")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  /** Le backend numérote les pages à partir de 0 ; l'utilisateur lit à partir de 1. */
  it("affiche la page en base 1 alors que le backend compte à partir de 0", () => {
    render(<Pagination page={0} totalPages={4} totalElements={87} onChangement={() => {}} />);

    expect(screen.getByText("Page 1 sur 4")).toBeInTheDocument();
    expect(screen.getByText("87 éléments")).toBeInTheDocument();
  });

  it("désactive les extrémités", () => {
    const { unmount } = render(
      <Pagination page={0} totalPages={3} totalElements={30} onChangement={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeEnabled();
    unmount();

    render(<Pagination page={2} totalPages={3} totalElements={30} onChangement={() => {}} />);
    expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
  });

  it("transmet l'index de page attendu par le backend", async () => {
    const onChangement = vi.fn();
    render(<Pagination page={1} totalPages={5} totalElements={50} onChangement={onChangement} />);

    await userEvent.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(onChangement).toHaveBeenCalledWith(2);
  });
});

describe("TableDonnees", () => {
  interface Ligne {
    reference: string;
  }
  const colonnes: ColumnDef<Ligne, unknown>[] = [
    { accessorKey: "reference", header: "Référence" },
  ];

  it("affiche l'état de chargement avant les données", () => {
    render(
      <TableDonnees
        colonnes={colonnes}
        donnees={undefined}
        chargement
        page={0}
        onChangementPage={() => {}}
      />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("affiche l'état vide plutôt qu'un tableau sans ligne", () => {
    render(
      <TableDonnees
        colonnes={colonnes}
        donnees={{ content: [], totalPages: 0, totalElements: 0 }}
        page={0}
        onChangementPage={() => {}}
      />,
    );

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  /** Le message du backend est plus précis que le nôtre : il doit primer. */
  it("relaie le message de l'erreur backend", () => {
    render(
      <TableDonnees
        colonnes={colonnes}
        donnees={undefined}
        erreur={new ErreurApi({ code: "ERR-FORBIDDEN", message: "Droits insuffisants" })}
        page={0}
        onChangementPage={() => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Droits insuffisants");
  });

  /**
   * La pagination vient du serveur : la table ne doit pas repaginer les lignes reçues. Deux lignes
   * envoyées, deux lignes affichées, même si le total en annonce 40.
   */
  it("affiche toutes les lignes reçues sans repaginer", () => {
    render(
      <TableDonnees
        colonnes={colonnes}
        donnees={{
          content: [{ reference: "DOS-001" }, { reference: "DOS-002" }],
          totalPages: 20,
          totalElements: 40,
        }}
        page={0}
        onChangementPage={() => {}}
      />,
    );

    const tableau = screen.getByRole("table");
    expect(within(tableau).getAllByRole("row")).toHaveLength(3); // en-tête + 2 lignes
    expect(screen.getByText("Page 1 sur 20")).toBeInTheDocument();
  });
});

describe("DialogueConfirmation", () => {
  /**
   * Motif central : `ERR-003` et `ERR-005` ne sont pas des échecs mais des demandes de confirmation,
   * rejouées avec `?forcer=true`.
   */
  it("propose de confirmer et d'annuler", async () => {
    const onConfirmation = vi.fn();
    const onFermeture = vi.fn();

    render(
      <DialogueConfirmation
        ouvert
        onFermeture={onFermeture}
        onConfirmation={onConfirmation}
        titre="Affectation déjà existante"
        message="Ce juriste est déjà affecté. Confirmer malgré tout ?"
      />,
    );

    expect(screen.getByText("Affectation déjà existante")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(onConfirmation).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onFermeture).toHaveBeenCalledOnce();
  });

  it("bascule l'action en variante destructive quand on le demande", () => {
    render(
      <DialogueConfirmation
        ouvert
        destructif
        onFermeture={() => {}}
        onConfirmation={() => {}}
        titre="Supprimer le document"
        message="Cette action est irréversible."
        libelleConfirmation="Supprimer"
      />,
    );

    expect(screen.getByRole("button", { name: "Supprimer" }).className).toContain("border-danger");
  });
});

describe("Televersement", () => {
  const fichier = (nom: string, taille: number) => {
    const f = new File(["x"], nom, { type: "application/octet-stream" });
    Object.defineProperty(f, "size", { value: taille });
    return f;
  };

  it("annonce les contraintes de la GED", () => {
    render(<Televersement nom="fichier" />);

    expect(screen.getByText(/PDF, PNG, JPG, TXT, XLSX/)).toBeInTheDocument();
    expect(screen.getByText(/10 Mo/)).toBeInTheDocument();
  });

  /** Le format est dérivé de l'extension, pas du type MIME — c'est la règle du backend (Q-46). */
  /**
   * `applyAccept: false` : par défaut `userEvent` respecte l'attribut `accept` et refuserait de
   * simuler la sélection — or c'est précisément ce cas qu'on veut couvrir. Un navigateur laisse
   * d'ailleurs choisir « tous les fichiers », l'attribut n'est donc pas une garantie.
   */
  it("refuse une extension non admise", async () => {
    const onChangement = vi.fn();
    const { container } = render(<Televersement nom="fichier" onChangement={onChangement} />);

    const champ = container.querySelector('input[type="file"]')!;
    await userEvent.upload(champ as HTMLInputElement, fichier("virus.exe", 1024), {
      applyAccept: false,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/format n’est pas accepté/i);
    expect(onChangement).toHaveBeenCalledWith(null);
  });

  it("refuse un fichier dépassant le plafond avant tout envoi", async () => {
    const onChangement = vi.fn();
    const { container } = render(<Televersement nom="fichier" onChangement={onChangement} />);

    const champ = container.querySelector('input[type="file"]')!;
    await userEvent.upload(champ as HTMLInputElement, fichier("gros.pdf", 11 * 1024 * 1024), {
      applyAccept: false,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/dépasse la taille maximale/i);
    expect(onChangement).toHaveBeenCalledWith(null);
  });

  it("accepte un fichier conforme", async () => {
    const onChangement = vi.fn();
    const { container } = render(<Televersement nom="fichier" onChangement={onChangement} />);

    const champ = container.querySelector('input[type="file"]')!;
    const valide = fichier("assignation.pdf", 2 * 1024 * 1024);
    await userEvent.upload(champ as HTMLInputElement, valide, { applyAccept: false });

    expect(screen.getByText("assignation.pdf")).toBeInTheDocument();
    expect(onChangement).toHaveBeenCalledWith(valide);
  });
});

describe("valeurs formatées", () => {
  it("formate le seuil du domaine en FCFA", () => {
    render(<MontantFcfa valeur={50_000_000} />);
    const rendu = screen.getByText(/50/).textContent!.replace(/\s/g, " ");
    expect(rendu).toContain("50 000 000");
  });

  it("affiche un tiret pour une valeur absente", () => {
    render(<MontantFcfa valeur={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("formate le plafond de la GED en mégaoctets", () => {
    render(<PoidsFichier valeur={10 * 1024 * 1024} />);
    expect(screen.getByText("10 Mo")).toBeInTheDocument();
  });
});
