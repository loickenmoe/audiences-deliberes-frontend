import {
  BellRing,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  Library,
  Receipt,
  Settings,
  Trash2,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Capacite } from "@/lib/rbac";

/**
 * Navigation principale.
 *
 * Chaque entrée porte une **clé de traduction** et une **capacité**, jamais un texte ni une liste de
 * rôles en dur : le libellé vient des fichiers de messages, la correspondance rôle → capacité de
 * `lib/rbac.ts`, elle-même dérivée des `@PreAuthorize` du backend.
 */
export interface EntreeNavigation {
  /** Clé dans l'espace `navigation` des fichiers de messages. */
  cle: string;
  href: string;
  icone: LucideIcon;
  capacite: Capacite;
  /** Jalon de livraison — les entrées non encore livrées ne sont pas affichées. */
  livre: boolean;
}

export const NAVIGATION: EntreeNavigation[] = [
  { cle: "accueil", href: "/", icone: LayoutDashboard, capacite: "consulterReferentiels", livre: true },
  { cle: "notifications", href: "/notifications", icone: BellRing, capacite: "consulterReferentiels", livre: true },
  { cle: "dossiers", href: "/dossiers", icone: FolderOpen, capacite: "consulterDossiers", livre: true },
  { cle: "clients", href: "/clients", icone: Briefcase, capacite: "consulterReferentiels", livre: true },
  { cle: "calendrier", href: "/audiences/calendrier", icone: CalendarDays, capacite: "consulterCalendrier", livre: true },
  { cle: "frais", href: "/frais", icone: Receipt, capacite: "consulterFrais", livre: true },
  { cle: "publications", href: "/publications", icone: FileSignature, capacite: "consulterPublications", livre: true },
  { cle: "constitutions", href: "/constitutions", icone: Gavel, capacite: "consulterConstitutions", livre: true },
  { cle: "repertoire", href: "/repertoire/avocats", icone: UsersRound, capacite: "consulterRepertoire", livre: true },
  { cle: "jurisprudence", href: "/jurisprudences", icone: Library, capacite: "consulterJurisprudence", livre: true },
  { cle: "tableauDeBord", href: "/tableau-de-bord", icone: LayoutDashboard, capacite: "consulterTableauDeBord", livre: false },
  { cle: "rapports", href: "/rapports", icone: Library, capacite: "genererRapport", livre: false },
  { cle: "demandesSuppression", href: "/ged/demandes-suppression", icone: Trash2, capacite: "arbitrerSuppressions", livre: true },
  { cle: "rapportJournalier", href: "/ged/rapport-journalier", icone: ClipboardList, capacite: "consulterRapportJournalier", livre: true },
  { cle: "intervenants", href: "/admin/intervenants", icone: Users, capacite: "consulterReferentiels", livre: true },
  { cle: "configuration", href: "/admin/configurations", icone: Settings, capacite: "consulterConfigurations", livre: true },
];
