import {
  BellRing,
  Briefcase,
  CalendarDays,
  FileSignature,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  Library,
  Receipt,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Capacite } from "@/lib/rbac";

/**
 * Navigation principale. Chaque entrée est rattachée à une **capacité**, jamais à une liste de rôles
 * écrite en dur : la correspondance rôle → capacité vit dans `lib/rbac.ts`, dérivée des
 * `@PreAuthorize` du backend. Une entrée dont l'utilisateur n'a pas la capacité n'est pas affichée.
 */
export interface EntreeNavigation {
  titre: string;
  href: string;
  icone: LucideIcon;
  capacite: Capacite;
  /** Jalon de livraison — les entrées non encore livrées ne sont pas affichées. */
  livre: boolean;
}

export const NAVIGATION: EntreeNavigation[] = [
  { titre: "Accueil", href: "/", icone: LayoutDashboard, capacite: "consulterReferentiels", livre: true },
  { titre: "Notifications", href: "/notifications", icone: BellRing, capacite: "consulterReferentiels", livre: false },
  { titre: "Dossiers", href: "/dossiers", icone: FolderOpen, capacite: "consulterDossiers", livre: false },
  { titre: "Clients", href: "/clients", icone: Briefcase, capacite: "consulterReferentiels", livre: false },
  { titre: "Calendrier", href: "/audiences/calendrier", icone: CalendarDays, capacite: "consulterCalendrier", livre: false },
  { titre: "Frais d'avocats", href: "/frais", icone: Receipt, capacite: "consulterFrais", livre: false },
  { titre: "Publications", href: "/publications", icone: FileSignature, capacite: "consulterPublications", livre: false },
  { titre: "Constitutions", href: "/constitutions", icone: Gavel, capacite: "consulterConstitutions", livre: false },
  { titre: "Répertoire des avocats", href: "/repertoire/avocats", icone: UsersRound, capacite: "consulterRepertoire", livre: false },
  { titre: "Jurisprudence", href: "/jurisprudences", icone: Library, capacite: "consulterJurisprudence", livre: false },
  { titre: "Tableau de bord", href: "/tableau-de-bord", icone: LayoutDashboard, capacite: "consulterTableauDeBord", livre: false },
  { titre: "Rapports", href: "/rapports", icone: Library, capacite: "genererRapport", livre: false },
  { titre: "Intervenants", href: "/admin/intervenants", icone: Users, capacite: "administrerIntervenants", livre: false },
  { titre: "Configuration", href: "/admin/configurations", icone: Settings, capacite: "consulterConfigurations", livre: false },
];
