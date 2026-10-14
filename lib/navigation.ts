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
  /*
   * **Accueil et Notifications sont ouverts à tout compte, avocat compris** (QF-59).
   *
   * Les deux entrées étaient adossées à `consulterReferentiels`, que l'avocat ne porte pas : elles
   * disparaissaient de son menu alors que les deux pages s'ouvraient parfaitement pour lui. Il les
   * atteignait par le **logo de la banque** et par la **cloche** - deux portes sans étiquette, qui
   * ne disent pas où elles mènent et ne marquent pas l'onglet de la page où l'on arrive. Signalé
   * par le porteur du projet le 2026-10-14.
   *
   * La capacité citée est celle de la page, pas celle d'un écran voisin : c'est l'erreur contre
   * laquelle met en garde le commentaire de « Mon compte », plus bas.
   */
  { cle: "accueil", href: "/", icone: LayoutDashboard, capacite: "consulterAccueil", livre: true },
  // Portail Avocat (F16) : les trois entrées qui lui sont **propres**, un prestataire externe ne
  // portant que `ROLE_AVOCAT`. Elles restent invisibles aux profils internes, sans capacité de
  // dépôt. **Elles n'étaient déjà pas les seules qu'il voie** : « Frais d'avocats » et
  // « Explications » le nomment aussi dans leurs capacités. QF-59 y ajoute Accueil et ses
  // Notifications.
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
   * Mon compte, et ce qui s’y trouve : ma signature (N8) et **mon activité** (Q-133).
   *
   * **Cette entrée manquait, et son absence rendait la page introuvable.** La seule porte était le
   * nom dans l’en-tête, souligné et sans étiquette - et ce nom est **masqué sous 640 px** (F17),
   * donc la page était purement inatteignable sur un écran étroit. Tant que « Mon compte » ne
   * portait qu’une signature déposée une fois pour toutes, s’en passer se défendait ; elle porte
   * désormais un rapport que chacun consulte sur la période qu’il choisit. Signalé par le porteur
   * du projet le 2026-10-13.
   *
   * **La capacité est celle de la page, `consulterReferentiels`, et pas `consulterMonActivite`.**
   * Depuis que l’avocat lit lui aussi son activité (Q-135), `consulterMonActivite` l’inclut : s’y
   * adosser lui aurait proposé une entrée menant à un refus de droits, *Mon compte* portant aussi
   * « Ma signature », qui n’a pas de sens pour lui - il ne signe aucune lettre de la banque. Son
   * activité est sur *Mon espace*, l’écran qui est le sien.
   */
  { cle: "monCompte", href: "/mon-compte", icone: UserCircle, capacite: "consulterReferentiels", livre: true },
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
