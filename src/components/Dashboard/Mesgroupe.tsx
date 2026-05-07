import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Repeat,
  History,
  Calendar,
  PlusCircle,
  UserPlus,
  Send,
  User,
  Settings,
  Bell,
  HelpCircle,
  ChevronDown,
  Search,
  Plus,
  Filter,
  ArrowRight,
  Star,
  Clock,
  AlertCircle,
  CheckCircle2,
  Crown,
  TrendingUp,
  Eye,
  MoreHorizontal,
  Copy,
  LogOut,
  Share2,
  ChevronRight,
  Sparkles,
  Shield,
  CalendarDays,
  Banknote,
  UserCheck,
  AlertTriangle,
  Gift,
} from 'lucide-react';

import styles from './MesGroupes.module.css';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════════════ */

interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  initials: string;
  reliabilityScore: number;
}

type GroupFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type GroupStatus = 'active' | 'paused' | 'completed';
type MemberRole = 'organizer' | 'co-organizer' | 'member';
type PaymentStatus = 'paid' | 'pending' | 'late' | 'not_due';
type UserGroupStatus = 'action_required' | 'your_turn' | 'up_to_date' | 'organizer' | 'completed';

interface GroupMember {
  id: string;
  name: string;
  initials: string;
  role: MemberRole;
  hasPaid: boolean;
}

interface TontineGroup {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  currency: string;
  frequency: GroupFrequency;
  totalMembers: number;
  currentTurn: number;
  totalTurns: number;
  status: GroupStatus;
  colorTheme: 'primary' | 'secondary' | 'purple' | 'green' | 'blue' | 'orange';
  inviteCode: string;
  createdAt: Date;
  nextPaymentDate: Date;
  
  // User-specific data
  userRole: MemberRole;
  userTurnNumber: number;
  userTurnDate: Date;
  userPaymentStatus: PaymentStatus;
  userTotalContributed: number;
  userTotalReceived: number;
  userStatus: UserGroupStatus;
  
  // Group health
  groupReliabilityScore: number;
  onTimePaymentRate: number;
  
  // Members preview
  membersPreview: GroupMember[];
  paidThisTurn: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: number | string;
  isActive?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

type FilterType = 'all' | 'active' | 'action_required' | 'your_turn' | 'completed';

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════════════════════════════════════ */

const currentUser: User = {
  id: 'user-001',
  firstName: 'Elhadj',
  lastName: 'Mamadou',
  phone: '+224 621 00 00 00',
  initials: 'EM',
  reliabilityScore: 95,
};

const userGroups: TontineGroup[] = [
  {
    id: 'group-001',
    name: 'Commerçants Madina',
    description: 'Tontine des commerçants du marché de Madina',
    contributionAmount: 1000000,
    currency: 'GNF',
    frequency: 'weekly',
    totalMembers: 20,
    currentTurn: 8,
    totalTurns: 20,
    status: 'active',
    colorTheme: 'secondary',
    inviteCode: 'CMD-2024-KRY',
    createdAt: new Date('2024-09-15'),
    nextPaymentDate: new Date('2025-01-05'),
    userRole: 'member',
    userTurnNumber: 8,
    userTurnDate: new Date('2025-01-05'),
    userPaymentStatus: 'not_due',
    userTotalContributed: 7000000,
    userTotalReceived: 0,
    userStatus: 'your_turn',
    groupReliabilityScore: 94,
    onTimePaymentRate: 96,
    membersPreview: [
      { id: 'u1', name: 'Mamadou D.', initials: 'MD', role: 'organizer', hasPaid: true },
      { id: 'u2', name: 'Fatoumata B.', initials: 'FB', role: 'member', hasPaid: true },
      { id: 'u3', name: 'Ibrahima S.', initials: 'IS', role: 'member', hasPaid: false },
    ],
    paidThisTurn: 16,
  },
  {
    id: 'group-002',
    name: 'Tontine Famille Diallo',
    description: 'Tontine familiale mensuelle pour les projets communs',
    contributionAmount: 500000,
    currency: 'GNF',
    frequency: 'monthly',
    totalMembers: 12,
    currentTurn: 9,
    totalTurns: 12,
    status: 'active',
    colorTheme: 'primary',
    inviteCode: 'FDL-2024-ABC',
    createdAt: new Date('2024-04-01'),
    nextPaymentDate: new Date('2025-01-15'),
    userRole: 'organizer',
    userTurnNumber: 3,
    userTurnDate: new Date('2024-06-15'),
    userPaymentStatus: 'pending',
    userTotalContributed: 4500000,
    userTotalReceived: 6000000,
    userStatus: 'action_required',
    groupReliabilityScore: 98,
    onTimePaymentRate: 100,
    membersPreview: [
      { id: 'u4', name: 'Vous', initials: 'EM', role: 'organizer', hasPaid: false },
      { id: 'u5', name: 'Kadiatou D.', initials: 'KD', role: 'co-organizer', hasPaid: true },
      { id: 'u6', name: 'Amadou D.', initials: 'AD', role: 'member', hasPaid: true },
    ],
    paidThisTurn: 10,
  },
  {
    id: 'group-003',
    name: 'Collègues Bureau',
    description: 'Tontine entre collègues de travail',
    contributionAmount: 200000,
    currency: 'GNF',
    frequency: 'monthly',
    totalMembers: 8,
    currentTurn: 3,
    totalTurns: 8,
    status: 'active',
    colorTheme: 'purple',
    inviteCode: 'CLB-2024-XYZ',
    createdAt: new Date('2024-11-01'),
    nextPaymentDate: new Date('2025-02-01'),
    userRole: 'member',
    userTurnNumber: 6,
    userTurnDate: new Date('2025-04-01'),
    userPaymentStatus: 'paid',
    userTotalContributed: 600000,
    userTotalReceived: 0,
    userStatus: 'up_to_date',
    groupReliabilityScore: 88,
    onTimePaymentRate: 92,
    membersPreview: [
      { id: 'u7', name: 'Sékou T.', initials: 'ST', role: 'organizer', hasPaid: true },
      { id: 'u8', name: 'Mariama C.', initials: 'MC', role: 'member', hasPaid: true },
      { id: 'u9', name: 'Oumar B.', initials: 'OB', role: 'member', hasPaid: true },
    ],
    paidThisTurn: 8,
  },
  {
    id: 'group-004',
    name: 'Entrepreneurs Kaloum',
    description: 'Réseau d\'entrepreneurs du quartier Kaloum',
    contributionAmount: 2000000,
    currency: 'GNF',
    frequency: 'monthly',
    totalMembers: 15,
    currentTurn: 5,
    totalTurns: 15,
    status: 'active',
    colorTheme: 'blue',
    inviteCode: 'ENT-2024-KLM',
    createdAt: new Date('2024-08-01'),
    nextPaymentDate: new Date('2025-01-10'),
    userRole: 'co-organizer',
    userTurnNumber: 12,
    userTurnDate: new Date('2025-07-10'),
    userPaymentStatus: 'late',
    userTotalContributed: 8000000,
    userTotalReceived: 0,
    userStatus: 'action_required',
    groupReliabilityScore: 91,
    onTimePaymentRate: 89,
    membersPreview: [
      { id: 'u10', name: 'Alpha B.', initials: 'AB', role: 'organizer', hasPaid: true },
      { id: 'u11', name: 'Vous', initials: 'EM', role: 'co-organizer', hasPaid: false },
      { id: 'u12', name: 'Fanta K.', initials: 'FK', role: 'member', hasPaid: true },
    ],
    paidThisTurn: 12,
  },
  {
    id: 'group-005',
    name: 'Anciens Lycée Donka',
    description: 'Tontine des anciens élèves du Lycée Donka promotion 2015',
    contributionAmount: 300000,
    currency: 'GNF',
    frequency: 'monthly',
    totalMembers: 10,
    currentTurn: 10,
    totalTurns: 10,
    status: 'completed',
    colorTheme: 'green',
    inviteCode: 'ALD-2024-DNK',
    createdAt: new Date('2024-01-15'),
    nextPaymentDate: new Date('2024-10-15'),
    userRole: 'member',
    userTurnNumber: 7,
    userTurnDate: new Date('2024-07-15'),
    userPaymentStatus: 'paid',
    userTotalContributed: 3000000,
    userTotalReceived: 3000000,
    userStatus: 'completed',
    groupReliabilityScore: 100,
    onTimePaymentRate: 100,
    membersPreview: [
      { id: 'u13', name: 'Binta S.', initials: 'BS', role: 'organizer', hasPaid: true },
      { id: 'u14', name: 'Mamady K.', initials: 'MK', role: 'member', hasPaid: true },
      { id: 'u15', name: 'Aissatou B.', initials: 'AB', role: 'member', hasPaid: true },
    ],
    paidThisTurn: 10,
  },
];

const navigationSections: NavSection[] = [
  {
    id: 'main',
    title: 'Menu principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', href: '/dashboard' },
      { id: 'groups', label: 'Mes groupes', icon: 'Users', href: '/groups', badge: 5, isActive: true },
      { id: 'contributions', label: 'Cotisations', icon: 'Wallet', href: '/contributions' },
      { id: 'rotations', label: 'Rotations & Tours', icon: 'Repeat', href: '/rotations' },
      { id: 'history', label: 'Historique', icon: 'History', href: '/history' },
      { id: 'calendar', label: 'Calendrier', icon: 'Calendar', href: '/calendar' },
    ],
  },
  {
    id: 'actions',
    title: 'Actions rapides',
    items: [
      { id: 'create-group', label: 'Créer un groupe', icon: 'PlusCircle', href: '/groups/create' },
      { id: 'join-group', label: 'Rejoindre un groupe', icon: 'UserPlus', href: '/groups/join' },
      { id: 'invite', label: 'Inviter des membres', icon: 'Send', href: '/invite' },
    ],
  },
  {
    id: 'account',
    title: 'Compte',
    items: [
      { id: 'profile', label: 'Mon profil', icon: 'User', href: '/profile' },
      { id: 'settings', label: 'Paramètres', icon: 'Settings', href: '/settings' },
      { id: 'notifications', label: 'Notifications', icon: 'Bell', href: '/notifications', badge: '•' },
      { id: 'help', label: 'Aide & Support', icon: 'HelpCircle', href: '/help' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
═══════════════════════════════════════════════════════════════════════════ */

const formatCurrency = (amount: number, currency: string = 'GNF'): string => {
  return new Intl.NumberFormat('fr-GN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ' + currency;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatRelativeDate = (date: Date): string => {
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `Il y a ${Math.abs(diffDays)} jours`;
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays <= 7) return `Dans ${diffDays} jours`;
  if (diffDays <= 30) return `Dans ${Math.ceil(diffDays / 7)} semaines`;
  return `Dans ${Math.ceil(diffDays / 30)} mois`;
};

const getFrequencyLabel = (frequency: GroupFrequency): string => {
  const labels: Record<GroupFrequency, string> = {
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    biweekly: 'Bimensuel',
    monthly: 'Mensuel',
  };
  return labels[frequency];
};

const getRoleLabel = (role: MemberRole): string => {
  const labels: Record<MemberRole, string> = {
    organizer: 'Organisateur',
    'co-organizer': 'Co-organisateur',
    member: 'Membre',
  };
  return labels[role];
};

/* ═══════════════════════════════════════════════════════════════════════════
   ICON MAPPING
═══════════════════════════════════════════════════════════════════════════ */

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Wallet,
  Repeat,
  History,
  Calendar,
  PlusCircle,
  UserPlus,
  Send,
  User,
  Settings,
  Bell,
  HelpCircle,
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

const TontineLogo: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
    <circle cx="100" cy="100" r="80" stroke="white" strokeWidth="4" fill="none" opacity="0.3" />
    <circle cx="100" cy="38" r="18" fill="#E8AA14" />
    <circle cx="152" cy="62" r="18" fill="white" />
    <circle cx="152" cy="138" r="18" fill="white" />
    <circle cx="100" cy="162" r="18" fill="white" />
    <circle cx="48" cy="138" r="18" fill="white" />
    <circle cx="48" cy="62" r="18" fill="white" />
    <circle cx="100" cy="100" r="28" fill="#E8AA14" />
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

const Sidebar: React.FC = () => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoSection}>
        <a href="/" className={styles.logoLink}>
          <div className={styles.logoIcon}>
            <TontineLogo />
          </div>
          <div>
            <span className={styles.logoText}>Tontine</span>
            <span className={`${styles.logoText} ${styles.logoTextHighlight}`}> Digital</span>
          </div>
        </a>
      </div>

      <nav className={styles.navigation}>
        {navigationSections.map((section) => (
          <div key={section.id} className={styles.navSection}>
            <p className={styles.navSectionTitle}>{section.title}</p>
            <ul className={styles.navList}>
              {section.items.map((item) => {
                const IconComponent = iconMap[item.icon];
                return (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className={`${styles.navItem} ${item.isActive ? styles.navItemActive : ''}`}
                    >
                      {IconComponent && <IconComponent className={styles.navIcon} />}
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.badge && typeof item.badge === 'number' && (
                        <span className={styles.navBadge}>{item.badge}</span>
                      )}
                      {item.badge === '•' && <span className={styles.navDot} />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={styles.userSection}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>{currentUser.initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{currentUser.firstName} {currentUser.lastName}</p>
            <p className={styles.userPhone}>{currentUser.phone}</p>
          </div>
          <ChevronDown className={styles.userChevron} />
        </div>
      </div>
    </aside>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   STAT CARD COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  variant: 'primary' | 'success' | 'secondary' | 'info';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subValue, variant }) => (
  <div className={`${styles.statCard} ${styles[`statCard${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}>
    <div className={styles.statCardIcon}>{icon}</div>
    <div className={styles.statCardContent}>
      <p className={styles.statCardLabel}>{label}</p>
      <p className={styles.statCardValue}>{value}</p>
      {subValue && <p className={styles.statCardSubValue}>{subValue}</p>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   GROUP CARD COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

interface GroupCardProps {
  group: TontineGroup;
  onViewDetails: (groupId: string) => void;
  onPay: (groupId: string) => void;
  onReceive: (groupId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onViewDetails, onPay, onReceive }) => {
  const [showMenu, setShowMenu] = useState(false);
  
  const progressPercent = (group.currentTurn / group.totalTurns) * 100;
  const paidPercent = (group.paidThisTurn / group.totalMembers) * 100;
  const potAmount = group.contributionAmount * group.totalMembers;
  
  // Determine status styling
  const getStatusConfig = () => {
    switch (group.userStatus) {
      case 'your_turn':
        return {
          badge: '🎉 C\'est votre tour !',
          badgeClass: styles.badgeYourTurn,
          borderClass: styles.cardBorderYourTurn,
          showReceiveBtn: true,
        };
      case 'action_required':
        return {
          badge: group.userPaymentStatus === 'late' ? '⚠️ Paiement en retard' : '💳 Cotisation à payer',
          badgeClass: group.userPaymentStatus === 'late' ? styles.badgeLate : styles.badgePending,
          borderClass: group.userPaymentStatus === 'late' ? styles.cardBorderLate : styles.cardBorderPending,
          showPayBtn: true,
        };
      case 'up_to_date':
        return {
          badge: '✓ À jour',
          badgeClass: styles.badgeUpToDate,
          borderClass: '',
        };
      case 'completed':
        return {
          badge: '✓ Cycle terminé',
          badgeClass: styles.badgeCompleted,
          borderClass: styles.cardBorderCompleted,
        };
      default:
        return { badge: '', badgeClass: '', borderClass: '' };
    }
  };
  
  const statusConfig = getStatusConfig();
  
  const colorClass = `theme${group.colorTheme.charAt(0).toUpperCase() + group.colorTheme.slice(1)}`;

  return (
    <div className={`${styles.groupCard} ${statusConfig.borderClass}`}>
      {/* Header */}
      <div className={styles.groupCardHeader}>
        <div className={`${styles.groupAvatar} ${styles[colorClass]}`}>
          <Users />
          {group.userRole === 'organizer' && (
            <span className={styles.organizerBadge}>
              <Crown />
            </span>
          )}
        </div>
        
        <div className={styles.groupInfo}>
          <div className={styles.groupTitleRow}>
            <h3 className={styles.groupName}>{group.name}</h3>
            <span className={`${styles.statusBadge} ${statusConfig.badgeClass}`}>
              {statusConfig.badge}
            </span>
          </div>
          <div className={styles.groupMeta}>
            <span className={styles.groupMetaItem}>
              <Users className={styles.metaIcon} />
              {group.totalMembers} membres
            </span>
            <span className={styles.groupMetaDivider}>•</span>
            <span className={styles.groupMetaItem}>
              <Repeat className={styles.metaIcon} />
              {getFrequencyLabel(group.frequency)}
            </span>
            <span className={styles.groupMetaDivider}>•</span>
            <span className={styles.groupMetaItem}>
              <Banknote className={styles.metaIcon} />
              {formatCurrency(group.contributionAmount)}
            </span>
          </div>
        </div>
        
        <div className={styles.groupActions}>
          <button 
            className={styles.menuBtn}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreHorizontal />
          </button>
          
          {showMenu && (
            <div className={styles.dropdownMenu}>
              <button className={styles.dropdownItem} onClick={() => onViewDetails(group.id)}>
                <Eye /> Voir détails
              </button>
              <button className={styles.dropdownItem}>
                <Share2 /> Inviter
              </button>
              <button className={styles.dropdownItem}>
                <Copy /> Copier code
              </button>
              {group.userRole !== 'organizer' && (
                <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}>
                  <LogOut /> Quitter le groupe
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className={styles.groupCardBody}>
        {/* Progress Section */}
        <div className={styles.progressSection}>
          <div className={styles.progressRow}>
            <div className={styles.progressInfo}>
              <span className={styles.progressLabel}>Progression du cycle</span>
              <span className={styles.progressValue}>Tour {group.currentTurn} sur {group.totalTurns}</span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={`${styles.progressFill} ${styles[colorClass]}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          {group.status === 'active' && (
            <div className={styles.progressRow}>
              <div className={styles.progressInfo}>
                <span className={styles.progressLabel}>Cotisations ce tour</span>
                <span className={styles.progressValue}>{group.paidThisTurn}/{group.totalMembers} payés</span>
              </div>
              <div className={styles.progressBar}>
                <div 
                  className={`${styles.progressFill} ${styles.progressFillGreen}`}
                  style={{ width: `${paidPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Key Info Grid */}
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <div className={styles.infoIcon}>
              <CalendarDays />
            </div>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>Votre tour</span>
              <span className={styles.infoValue}>#{group.userTurnNumber}</span>
              <span className={styles.infoSubtext}>{formatRelativeDate(group.userTurnDate)}</span>
            </div>
          </div>
          
          <div className={styles.infoItem}>
            <div className={styles.infoIcon}>
              <Gift />
            </div>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>Cagnotte</span>
              <span className={styles.infoValue}>{formatCurrency(potAmount)}</span>
              <span className={styles.infoSubtext}>{group.totalMembers} × {formatCurrency(group.contributionAmount).replace(' GNF', '')}</span>
            </div>
          </div>
          
          <div className={styles.infoItem}>
            <div className={styles.infoIcon}>
              <TrendingUp />
            </div>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>Cotisé / Reçu</span>
              <span className={styles.infoValue}>{formatCurrency(group.userTotalContributed).replace(' GNF', '')}</span>
              <span className={styles.infoSubtext}>
                {group.userTotalReceived > 0 
                  ? `Reçu: ${formatCurrency(group.userTotalReceived)}`
                  : 'Pas encore reçu'
                }
              </span>
            </div>
          </div>
          
          <div className={styles.infoItem}>
            <div className={styles.infoIcon}>
              <Shield />
            </div>
            <div className={styles.infoContent}>
              <span className={styles.infoLabel}>Fiabilité</span>
              <span className={`${styles.infoValue} ${group.groupReliabilityScore >= 90 ? styles.infoValueGreen : ''}`}>
                {group.groupReliabilityScore}%
              </span>
              <span className={styles.infoSubtext}>{group.onTimePaymentRate}% à temps</span>
            </div>
          </div>
        </div>
        
        {/* Members Preview */}
        <div className={styles.membersPreview}>
          <div className={styles.membersAvatars}>
            {group.membersPreview.slice(0, 4).map((member, index) => (
              <div 
                key={member.id}
                className={`${styles.memberAvatar} ${member.hasPaid ? styles.memberAvatarPaid : styles.memberAvatarPending}`}
                style={{ zIndex: 10 - index }}
                title={`${member.name} - ${member.hasPaid ? 'Payé' : 'En attente'}`}
              >
                {member.initials}
              </div>
            ))}
            {group.totalMembers > 4 && (
              <div className={styles.memberAvatarMore}>
                +{group.totalMembers - 4}
              </div>
            )}
          </div>
          <span className={styles.membersLabel}>
            {group.paidThisTurn} payés • {group.totalMembers - group.paidThisTurn} en attente
          </span>
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className={styles.groupCardFooter}>
        {group.status === 'active' && (
          <>
            {group.userRole === 'organizer' && (
              <span className={styles.roleTag}>
                <Crown /> Organisateur
              </span>
            )}
            {group.userRole === 'co-organizer' && (
              <span className={styles.roleTagSecondary}>
                <UserCheck /> Co-organisateur
              </span>
            )}
          </>
        )}
        
        <div className={styles.footerActions}>
          {statusConfig.showPayBtn && (
            <button 
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={() => onPay(group.id)}
            >
              <Wallet /> Payer {formatCurrency(group.contributionAmount)}
            </button>
          )}
          
          {statusConfig.showReceiveBtn && (
            <button 
              className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
              onClick={() => onReceive(group.id)}
            >
              <Gift /> Recevoir ma cagnotte
            </button>
          )}
          
          <button 
            className={styles.viewDetailsBtn}
            onClick={() => onViewDetails(group.id)}
          >
            Voir détails <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

const EmptyState: React.FC<{ filter: FilterType }> = ({ filter }) => {
  const messages: Record<FilterType, { title: string; description: string }> = {
    all: {
      title: 'Aucun groupe',
      description: 'Vous n\'avez pas encore rejoint de groupe de tontine.',
    },
    active: {
      title: 'Aucun groupe actif',
      description: 'Vous n\'avez pas de groupe en cours.',
    },
    action_required: {
      title: 'Aucune action requise',
      description: 'Vous êtes à jour sur toutes vos cotisations ! 🎉',
    },
    your_turn: {
      title: 'Pas encore votre tour',
      description: 'Aucune cagnotte à recevoir pour le moment.',
    },
    completed: {
      title: 'Aucun groupe terminé',
      description: 'Vos cycles de tontine en cours seront affichés ici une fois terminés.',
    },
  };

  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyStateIcon}>
        <Users />
      </div>
      <h3 className={styles.emptyStateTitle}>{messages[filter].title}</h3>
      <p className={styles.emptyStateText}>{messages[filter].description}</p>
      {filter === 'all' && (
        <div className={styles.emptyStateActions}>
          <button className={styles.emptyStateBtnPrimary}>
            <Plus /> Créer un groupe
          </button>
          <button className={styles.emptyStateBtnSecondary}>
            <UserPlus /> Rejoindre avec un code
          </button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   JOIN GROUP MODAL COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JoinModal: React.FC<JoinModalProps> = ({ isOpen, onClose }) => {
  const [code, setCode] = useState('');
  
  if (!isOpen) return null;
  
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Rejoindre un groupe</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            Entrez le code d'invitation fourni par l'organisateur du groupe.
          </p>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Code d'invitation</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Ex: CMD-2024-KRY"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.modalBtnSecondary} onClick={onClose}>
            Annuler
          </button>
          <button className={styles.modalBtnPrimary} disabled={!code.trim()}>
            <UserPlus /> Rejoindre
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN MES GROUPES COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

export const MesGroupes: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Calculate stats
  const stats = useMemo(() => {
    const activeGroups = userGroups.filter(g => g.status === 'active');
    const totalContributed = userGroups.reduce((sum, g) => sum + g.userTotalContributed, 0);
    const totalReceived = userGroups.reduce((sum, g) => sum + g.userTotalReceived, 0);
    const actionRequired = userGroups.filter(g => g.userStatus === 'action_required').length;
    
    return {
      totalGroups: userGroups.length,
      activeGroups: activeGroups.length,
      totalContributed,
      totalReceived,
      actionRequired,
    };
  }, []);
  
  // Filter groups
  const filteredGroups = useMemo(() => {
    let groups = userGroups;
    
    // Apply filter
    switch (activeFilter) {
      case 'active':
        groups = groups.filter(g => g.status === 'active');
        break;
      case 'action_required':
        groups = groups.filter(g => g.userStatus === 'action_required');
        break;
      case 'your_turn':
        groups = groups.filter(g => g.userStatus === 'your_turn');
        break;
      case 'completed':
        groups = groups.filter(g => g.status === 'completed');
        break;
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      groups = groups.filter(g => 
        g.name.toLowerCase().includes(query) ||
        g.description?.toLowerCase().includes(query) ||
        g.inviteCode.toLowerCase().includes(query)
      );
    }
    
    return groups;
  }, [activeFilter, searchQuery]);
  
  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'Tous', count: userGroups.length },
    { key: 'active', label: 'Actifs', count: userGroups.filter(g => g.status === 'active').length },
    { key: 'action_required', label: 'À payer', count: stats.actionRequired },
    { key: 'your_turn', label: 'Mon tour', count: userGroups.filter(g => g.userStatus === 'your_turn').length },
    { key: 'completed', label: 'Terminés', count: userGroups.filter(g => g.status === 'completed').length },
  ];

  return (
    <div className={styles.pageLayout}>
      <Sidebar />
      
      <main className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.headerLeft}>
              <h1>Mes Groupes</h1>
              <p>Gérez vos tontines et suivez vos cotisations</p>
            </div>
            
            <div className={styles.headerRight}>
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Rechercher un groupe..."
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <button className={styles.notificationBtn}>
                <Bell />
                <span className={styles.notificationBadge}>2</span>
              </button>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className={styles.pageContent}>
          {/* Stats Row */}
          <div className={styles.statsRow}>
            <StatCard
              icon={<Users />}
              label="Groupes actifs"
              value={stats.activeGroups.toString()}
              subValue={`${stats.totalGroups} au total`}
              variant="primary"
            />
            <StatCard
              icon={<TrendingUp />}
              label="Total cotisé"
              value={formatCurrency(stats.totalContributed)}
              variant="info"
            />
            <StatCard
              icon={<Gift />}
              label="Total reçu"
              value={formatCurrency(stats.totalReceived)}
              variant="success"
            />
            <StatCard
              icon={<AlertCircle />}
              label="Actions requises"
              value={stats.actionRequired.toString()}
              subValue={stats.actionRequired > 0 ? 'Paiements en attente' : 'Tout est à jour'}
              variant={stats.actionRequired > 0 ? 'secondary' : 'success'}
            />
          </div>
          
          {/* Actions Bar */}
          <div className={styles.actionsBar}>
            <div className={styles.ctaButtons}>
              <button className={styles.ctaBtnPrimary}>
                <Plus /> Créer un groupe
              </button>
              <button 
                className={styles.ctaBtnSecondary}
                onClick={() => setShowJoinModal(true)}
              >
                <UserPlus /> Rejoindre avec un code
              </button>
            </div>
            
            <div className={styles.filterTabs}>
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  className={`${styles.filterTab} ${activeFilter === filter.key ? styles.filterTabActive : ''}`}
                  onClick={() => setActiveFilter(filter.key)}
                >
                  {filter.label}
                  {filter.count !== undefined && filter.count > 0 && (
                    <span className={styles.filterCount}>{filter.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          {/* Groups List */}
          {filteredGroups.length > 0 ? (
            <div className={styles.groupsList}>
              {filteredGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onViewDetails={(id) => console.log('View details:', id)}
                  onPay={(id) => console.log('Pay:', id)}
                  onReceive={(id) => console.log('Receive:', id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState filter={activeFilter} />
          )}
        </div>
      </main>
      
      <JoinModal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} />
    </div>
  );
};

export default MesGroupes;