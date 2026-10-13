import {
  BellRing,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  FileSignature,
  FolderOpen,
  Gavel,
  Landmark,
  LayoutDashboard,
  Library,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  Trash2,
  Users,
  UserCircle,
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
  // Portail Avocat (F16) : ces trois entrées sont les seules que voit un prestataire externe, qui ne
  // porte que `ROLE_AVOCAT`. Elles restent invisibles aux profils internes, sans capacité de dépôt.
  { cle: "monEspace", href: "/portail", icone: Briefcase, capacite: "deposerPublication", livre: true },
  { cle: "deposerFrais", href: "/frais/nouvelle", icone: Receipt, capacite: "deposerFrais", livre: true },
  { cle: "deposerPublication", href: "/publications/nouvelle", icone: FileSignature, capacite: "deposerPublication", livre: true },
  { cle: "notifications", href: "/notifications", icone: BellRing, capacite: "consulterReferentiels", livre: true },
  { cle: "dossiers", href: "/dossiers", icone: FolderOpen, capacite: "consulterDossiers", livre: true },
  { cle: "clients", href: "/clients", icone: Briefcase, capacite: "consulterReferentiels", livre: true },
  { cle: "calendrier", href: "/audiences/calendrier", icone: CalendarDays, capacite: "consulterCalendrier", livre: true },
  { cle: "journalAudiences", href: "/audiences/journal", icone: ClipboardList, capacite: "consulterJournalAudiences", livre: true },
  { cle: "frais", href: "/frais", icone: Receipt, capacite: "consulterFrais", livre: true },
  { cle: "publications", href: "/publications", icone: FileSignature, capacite: "consulterPublications", livre: true },
  { cle: "constitutions", href: "/constitutions", icone: Gavel, capacite: "consulterConstitutions", livre: true },
  { cle: "repertoire", href: "/repertoire/avocats", icone: UsersRound, capacite: "consulterRepertoire", livre: true },
  { cle: "explications", href: "/demandes-explication", icone: MessageSquare, capacite: "consulterExplications", livre: true },
  { cle: "jurisprudence", href: "/jurisprudences", icone: Library, capacite: "consulterJurisprudence", livre: true },
  /*
   * Mon compte, et ce qui s’y trouve : ma signature (N8) et **mon activité** (Q-133).
   *
   * **Cette entrée manquait, et son absence rendait la page introuvable.** La seule porte était le
   * nom dans l’en-tête, souligné et sans étiquette - et ce nom est **masqué sous 640 px** (F17),
   * donc la page était purement inatteignable sur un écran étroit. Tant que « Mon compte » ne
   * portait qu’une signature déposée une fois pour toutes, s’en passer se défendait ; elle porte
   * désormais un rapport que chacun consulte sur la période qu’il choisit. Signalé par le porteur
   * du projet le 2026-10-13.
   *
   * La capacité est `consulterMonActivite` et non `consulterReferentiels` : c’est ce que la page
   * porte de plus utile, et cette capacité dit exactement à qui - les cinq profils internes, pas
   * l’avocat, qui n’a aucune des natures d’action comptées.
   */
  { cle: "monCompte", href: "/mon-compte", icone: UserCircle, capacite: "consulterMonActivite", livre: true },
  { cle: "tableauDeBord", href: "/tableau-de-bord", icone: LayoutDashboard, capacite: "consulterTableauDeBord", livre: true },
  { cle: "rapports", href: "/rapports", icone: FileBarChart, capacite: "genererRapport", livre: true },
  { cle: "demandesSuppression", href: "/ged/demandes-suppression", icone: Trash2, capacite: "arbitrerSuppressions", livre: true },
  { cle: "rapportJournalier", href: "/ged/rapport-journalier", icone: ClipboardList, capacite: "consulterRapportJournalier", livre: true },
  { cle: "intervenants", href: "/admin/intervenants", icone: Users, capacite: "consulterReferentiels", livre: true },
  { cle: "agences", href: "/admin/agences", icone: Landmark, capacite: "consulterReferentiels", livre: true },
  { cle: "configuration", href: "/admin/configurations", icone: Settings, capacite: "consulterConfigurations", livre: true },
  // Audit (Q-112) : écran d'enquête, distinct de l'administration. Visible du DJ et de la DJA seuls.
  { cle: "audit", href: "/admin/audit", icone: ScrollText, capacite: "consulterAudit", livre: true },
];
