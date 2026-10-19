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
  Share2,
  Settings,
  Trash2,
  Users,
  UserCircle,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Capacite } from "@/lib/rbac";

/**
 * Main navigation.
 *
 * Each entry has a translation key and a capability, never hard-coded text or roles: labels come
 * from the message files, and the role-to-capability mapping from `lib/rbac.ts`, itself derived
 * from the backend `@PreAuthorize` rules.
 */
export interface EntreeNavigation {
  /** Key in the `navigation` namespace of the message files. */
  cle: string;
  href: string;
  icone: LucideIcon;
  capacite: Capacite;
  /** Delivery flag: entries not yet delivered are hidden. */
  livre: boolean;
}

export const NAVIGATION: EntreeNavigation[] = [
  /*
   * Home and Notifications are open to every account, lawyers included. Each entry uses the
   * capability of its own page, not that of a neighbouring screen (see "Mon compte" below).
   */
  { cle: "accueil", href: "/", icone: LayoutDashboard, capacite: "consulterAccueil", livre: true },
  // Lawyer portal: the three entries specific to external lawyers (`ROLE_AVOCAT` only), hidden from
  // internal profiles, which lack the filing capabilities. Lawyers also see lawyer fees and
  // explanation requests, Home and Notifications.
  { cle: "monEspace", href: "/portail", icone: Briefcase, capacite: "deposerPublication", livre: true },
  { cle: "deposerFrais", href: "/frais/nouvelle", icone: Receipt, capacite: "deposerFrais", livre: true },
  { cle: "deposerPublication", href: "/publications/nouvelle", icone: FileSignature, capacite: "deposerPublication", livre: true },
  { cle: "notifications", href: "/notifications", icone: BellRing, capacite: "consulterSesNotifications", livre: true },
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
   * My account: my signature and my activity. The header name linking here is hidden below 640 px,
   * so this entry is the only way to reach the page on narrow screens.
   *
   * The capability is the page's (`consulterReferentiels`), not `consulterMonActivite`: the latter
   * includes lawyers, who would be led to a permission denial (they sign no bank letters). A
   * lawyer's activity is shown on their own portal.
   */
  { cle: "monCompte", href: "/mon-compte", icone: UserCircle, capacite: "consulterReferentiels", livre: true },
  { cle: "tableauDeBord", href: "/tableau-de-bord", icone: LayoutDashboard, capacite: "consulterTableauDeBord", livre: true },
  { cle: "rapports", href: "/rapports", icone: FileBarChart, capacite: "genererRapport", livre: true },
  { cle: "demandesSuppression", href: "/ged/demandes-suppression", icone: Trash2, capacite: "arbitrerSuppressions", livre: true },
  // Document shares proposed on sensitive case files, approved by the DJ and the DJA.
  { cle: "partagesAvocat", href: "/ged/partages-avocat", icone: Share2, capacite: "arbitrerPartages", livre: true },
  { cle: "rapportJournalier", href: "/ged/rapport-journalier", icone: ClipboardList, capacite: "consulterRapportJournalier", livre: true },
  { cle: "intervenants", href: "/admin/intervenants", icone: Users, capacite: "consulterReferentiels", livre: true },
  { cle: "agences", href: "/admin/agences", icone: Landmark, capacite: "consulterReferentiels", livre: true },
  { cle: "configuration", href: "/admin/configurations", icone: Settings, capacite: "consulterConfigurations", livre: true },
  // Audit: investigation screen, separate from administration. Visible to the DJ and the DJA only.
  { cle: "audit", href: "/admin/audit", icone: ScrollText, capacite: "consulterAudit", livre: true },
];
