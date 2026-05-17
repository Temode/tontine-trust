
import React, { useState } from 'react';
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
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Star,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  CreditCard,
  FileText,
} from 'lucide-react';

import styles from './Dashboard.module.css';

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
  isVerified: boolean;
  memberSince: Date;
}

type GroupFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type GroupStatus = 'pending' | 'active' | 'completed' | 'paused';

interface Group {
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
  colorTheme: 'primary' | 'secondary' | 'purple' | 'green';
}

interface Transaction {
  id: string;
  type: 'contribution' | 'payout' | 'penalty';
  groupId: string;
  groupName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  date: Date;
}

interface DashboardStats {
  totalBalance: number;
  monthlyChange: number;
  monthlyChangePercent: number;
  contributionsMade: number;
  contributionsTotal: number;
  potsReceived: number;
  potsTotal: number;
  nextPotDate?: Date;
}

interface UpcomingDeadline {
  id: string;
  groupId: string;
  groupName: string;
  type: 'contribution' | 'payout';
  amount: number;
  dueDate: Date;
  daysRemaining: number;
  isUrgent: boolean;
}

interface MemberPaymentStatus {
  userId: string;
  initials: string;
  name: string;
  status: 'paid' | 'pending' | 'late' | 'beneficiary';
  isBeneficiary: boolean;
  isCurrentUser: boolean;
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

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  colorClass: string;
}

interface GroupDistribution {
  groupId: string;
  groupName: string;
  percentage: number;
  color: string;
}

interface ReliabilityStats {
  score: number;
  rating: string;
  onTimePayments: number;
  totalPayments: number;
  latePayments: number;
  memberSinceMonths: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════════════════════════════════════ */

const currentUser: User = {
  id: 'user-001',
  firstName: 'Elhadj',
  lastName: 'Mamadou',
  phone: '+224 621 00 00 00',
  initials: 'ED',
  reliabilityScore: 95,
  isVerified: true,
  memberSince: new Date('2024-05-15'),
};

const dashboardStats: DashboardStats = {
  totalBalance: 26500000,
  monthlyChange: 4500000,
  monthlyChangePercent: 12.5,
  contributionsMade: 12,
  contributionsTotal: 8200000,
  potsReceived: 2,
  potsTotal: 18300000,
  nextPotDate: new Date('2025-01-15'),
};

const userGroups: Group[] = [
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
  },
  {
    id: 'group-002',
    name: 'Tontine Famille Diallo',
    description: 'Tontine familiale mensuelle',
    contributionAmount: 500000,
    currency: 'GNF',
    frequency: 'monthly',
    totalMembers: 12,
    currentTurn: 9,
    totalTurns: 12,
    status: 'active',
    colorTheme: 'primary',
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
  },
];

const upcomingDeadlines: UpcomingDeadline[] = [
  {
    id: 'deadline-001',
    groupId: 'group-001',
    groupName: 'Commerçants Madina',
    type: 'contribution',
    amount: 1000000,
    dueDate: new Date('2025-01-05'),
    daysRemaining: 2,
    isUrgent: true,
  },
  {
    id: 'deadline-002',
    groupId: 'group-002',
    groupName: 'Famille Diallo',
    type: 'contribution',
    amount: 500000,
    dueDate: new Date('2025-01-15'),
    daysRemaining: 12,
    isUrgent: false,
  },
  {
    id: 'deadline-003',
    groupId: 'group-003',
    groupName: 'Collègues Bureau',
    type: 'contribution',
    amount: 200000,
    dueDate: new Date('2025-02-01'),
    daysRemaining: 29,
    isUrgent: false,
  },
  {
    id: 'deadline-004',
    groupId: 'group-001',
    groupName: 'Commerçants Madina',
    type: 'payout',
    amount: 20000000,
    dueDate: new Date('2025-01-05'),
    daysRemaining: 2,
    isUrgent: false,
  },
];

const recentTransactions: Transaction[] = [
  {
    id: 'txn-001',
    type: 'payout',
    groupId: 'group-002',
    groupName: 'Famille Diallo',
    amount: 6000000,
    currency: 'GNF',
    status: 'completed',
    date: new Date('2024-12-25'),
  },
  {
    id: 'txn-002',
    type: 'contribution',
    groupId: 'group-002',
    groupName: 'Famille Diallo',
    amount: 500000,
    currency: 'GNF',
    status: 'completed',
    date: new Date('2024-12-28'),
  },
  {
    id: 'txn-003',
    type: 'contribution',
    groupId: 'group-001',
    groupName: 'Commerçants Madina',
    amount: 1000000,
    currency: 'GNF',
    status: 'completed',
    date: new Date('2024-12-29'),
  },
  {
    id: 'txn-004',
    type: 'contribution',
    groupId: 'group-003',
    groupName: 'Collègues Bureau',
    amount: 200000,
    currency: 'GNF',
    status: 'completed',
    date: new Date('2025-01-01'),
  },
];

const membersPaymentStatus: MemberPaymentStatus[] = [
  { userId: 'user-002', initials: 'MD', name: 'Mamadou D.', status: 'paid', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-003', initials: 'FB', name: 'Fatoumata B.', status: 'paid', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-004', initials: 'IS', name: 'Ibrahima S.', status: 'paid', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-005', initials: 'OB', name: 'Ousmane B.', status: 'paid', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-006', initials: 'MT', name: 'Mariama T.', status: 'paid', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-007', initials: 'AC', name: 'Aissatou C.', status: 'pending', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-008', initials: 'AK', name: 'Abdoulaye K.', status: 'pending', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-009', initials: 'SK', name: 'Sekou K.', status: 'late', isBeneficiary: false, isCurrentUser: false },
  { userId: 'user-001', initials: 'ED', name: 'Vous', status: 'beneficiary', isBeneficiary: true, isCurrentUser: true },
];

const navigationSections: NavSection[] = [
  {
    id: 'main',
    title: 'Menu principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', href: '/dashboard', isActive: true },
      { id: 'groups', label: 'Mes groupes', icon: 'Users', href: '/groups', badge: 3 },
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

const quickActions: QuickAction[] = [
  {
    id: 'create-group',
    title: 'Créer un groupe',
    description: 'Démarrer une nouvelle tontine',
    icon: 'PlusCircle',
    href: '/groups/create',
    colorClass: 'primary',
  },
  {
    id: 'invite',
    title: 'Inviter des membres',
    description: "Partager un lien d'invitation",
    icon: 'UserPlus',
    href: '/invite',
    colorClass: 'secondary',
  },
  {
    id: 'exchange-turn',
    title: 'Échanger mon tour',
    description: 'Proposer un échange',
    icon: 'Repeat',
    href: '/rotations/exchange',
    colorClass: 'purple',
  },
  {
    id: 'receipts',
    title: 'Mes reçus',
    description: 'Télécharger les justificatifs',
    icon: 'FileText',
    href: '/receipts',
    colorClass: 'green',
  },
];

const reliabilityStats: ReliabilityStats = {
  score: 95,
  rating: 'Excellent',
  onTimePayments: 12,
  totalPayments: 12,
  latePayments: 0,
  memberSinceMonths: 8,
};

const groupDistribution: GroupDistribution[] = [
  { groupId: 'group-001', groupName: 'Commerçants Madina', percentage: 59, color: 'secondary' },
  { groupId: 'group-002', groupName: 'Famille Diallo', percentage: 29, color: 'primary' },
  { groupId: 'group-003', groupName: 'Collègues Bureau', percentage: 12, color: 'purple' },
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

const getMonthAbbrev = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short' })
    .format(date)
    .toUpperCase()
    .replace('.', '');
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
  FileText,
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
      {/* Logo Section */}
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

      {/* Navigation */}
      <nav className={styles.navigation}>
        {navigationSections.map((section) => (
          <div key={section.id} className={styles.navSection}>
            <p className={styles.navSectionTitle}>{section.title}</p>
            <ul className={styles.navList}>
              {section.items.map((item) => {
                const IconComponent = iconMap[item.icon];
                const isActive = item.isActive;

                return (
                  <li key={item.id}>
                    <a
                      href={item.href}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
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

      {/* User Profile */}
      <div className={styles.userSection}>
        <div className={styles.userCard}>
          <div className={styles.userAvatar}>{currentUser.initials}</div>
          <div className={styles.userInfo}>
            <p className={styles.userName}>
              {currentUser.firstName} {currentUser.lastName}
            </p>
            <p className={styles.userPhone}>{currentUser.phone}</p>
          </div>
          <ChevronDown className={styles.userChevron} />
        </div>
      </div>
    </aside>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

interface GroupListItemProps {
  group: Group;
  isYourTurn?: boolean;
}

const GroupListItem: React.FC<GroupListItemProps> = ({ group, isYourTurn }) => {
  const progressPercent = (group.currentTurn / group.totalTurns) * 100;
  const potAmount = group.contributionAmount * group.totalMembers;

  const colorClass = group.colorTheme === 'secondary'
    ? 'Secondary'
    : group.colorTheme === 'purple'
      ? 'Purple'
      : 'Primary';

  return (
    <div className={styles.groupItem}>
      <div className={styles.groupItemInner}>
        <div className={`${styles.groupAvatar} ${styles[`groupAvatar${colorClass}`]}`}>
          <Users />
          {isYourTurn && (
            <span className={styles.groupAvatarBadge}>
              <Star />
            </span>
          )}
        </div>

        <div className={styles.groupInfo}>
          <div className={styles.groupNameRow}>
            <h3 className={styles.groupName}>{group.name}</h3>
            {isYourTurn ? (
              <span className={`${styles.groupBadge} ${styles.groupBadgeYourTurn}`}>
                🎉 Votre tour!
              </span>
            ) : (
              <span className={`${styles.groupBadge} ${styles.groupBadgeActive}`}>
                Actif
              </span>
            )}
          </div>
          <p className={styles.groupMeta}>
            {group.totalMembers} membres · {group.frequency === 'weekly' ? 'Hebdomadaire' : 'Mensuelle'} · {formatCurrency(group.contributionAmount)}
          </p>
          <div className={styles.groupProgress}>
            <div className={styles.groupProgressHeader}>
              <span>Progression du cycle</span>
              <span className={styles.groupProgressValue}>
                {group.currentTurn}/{group.totalTurns} tours
              </span>
            </div>
            <div className={styles.groupProgressBar}>
              <div
                className={`${styles.groupProgressFill} ${styles[`groupProgressFill${colorClass}`]}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className={styles.groupRight}>
          {isYourTurn ? (
            <>
              <p className={styles.groupRightLabel}>Cagnotte</p>
              <p className={`${styles.groupRightValue} ${styles.groupRightValueSecondary}`}>
                {formatCurrency(potAmount)}
              </p>
              <button className={styles.receiveButton}>Recevoir</button>
            </>
          ) : (
            <>
              <p className={styles.groupRightLabel}>Votre tour</p>
              <p className={styles.groupRightValue}>#11</p>
              <p className={styles.groupRightSubtext}>Dans 2 mois</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface DeadlineItemProps {
  deadline: UpcomingDeadline;
}

const DeadlineItem: React.FC<DeadlineItemProps> = ({ deadline }) => {
  const isPayout = deadline.type === 'payout';
  const isUrgent = deadline.isUrgent && !isPayout;

  const itemClass = isPayout
    ? styles.deadlineItemPayout
    : isUrgent
      ? styles.deadlineItemUrgent
      : styles.deadlineItemNormal;

  const dateClass = isPayout
    ? styles.deadlineDatePayout
    : isUrgent
      ? styles.deadlineDateUrgent
      : styles.deadlineDateNormal;

  return (
    <div className={`${styles.deadlineItem} ${itemClass}`}>
      <div className={`${styles.deadlineDate} ${dateClass}`}>
        <span className={styles.deadlineMonth} style={{ color: isPayout ? '#047857' : isUrgent ? '#dc2626' : '#64748b' }}>
          {getMonthAbbrev(deadline.dueDate)}
        </span>
        <span className={styles.deadlineDay} style={{ color: isPayout ? '#047857' : isUrgent ? '#dc2626' : '#334155' }}>
          {deadline.dueDate.getDate().toString().padStart(2, '0')}
        </span>
      </div>
      <div className={styles.deadlineInfo}>
        <p className={styles.deadlineGroupName}>{deadline.groupName}</p>
        <p className={isPayout ? styles.deadlineTypePayout : styles.deadlineType}>
          {isPayout ? '🎉 Vous recevez!' : 'Cotisation à payer'}
        </p>
      </div>
      <div className={styles.deadlineRight}>
        <p className={`${styles.deadlineAmount} ${isPayout ? styles.deadlineAmountPayout : isUrgent ? styles.deadlineAmountUrgent : ''}`}>
          {isPayout ? '+' : ''}{formatCurrency(deadline.amount)}
        </p>
        <p className={`${styles.deadlineRemaining} ${isPayout ? styles.deadlineRemainingPayout : isUrgent ? styles.deadlineRemainingUrgent : ''}`}>
          Dans {deadline.daysRemaining} jours
        </p>
      </div>
    </div>
  );
};

const TransactionsTable: React.FC = () => (
  <table className={styles.table}>
    <thead className={styles.tableHead}>
      <tr>
        <th className={styles.tableHeadCell}>Type</th>
        <th className={styles.tableHeadCell}>Groupe</th>
        <th className={styles.tableHeadCell}>Montant</th>
        <th className={styles.tableHeadCell}>Date</th>
        <th className={styles.tableHeadCell}>Statut</th>
        <th className={styles.tableHeadCell}>Reçu</th>
      </tr>
    </thead>
    <tbody>
      {recentTransactions.map((txn) => (
        <tr key={txn.id} className={styles.tableRow}>
          <td className={styles.tableCell}>
            <div className={styles.transactionType}>
              <div className={`${styles.transactionTypeIcon} ${txn.type === 'payout' ? styles.transactionTypeIconReceived : styles.transactionTypeIconPaid}`}>
                {txn.type === 'payout' ? <ArrowDownLeft /> : <ArrowUpRight />}
              </div>
              <span className={styles.transactionTypeLabel}>
                {txn.type === 'payout' ? 'Reçu' : 'Payé'}
              </span>
            </div>
          </td>
          <td className={styles.tableCell}>
            <span className={styles.transactionGroup}>{txn.groupName}</span>
          </td>
          <td className={styles.tableCell}>
            <span className={`${styles.transactionAmount} ${txn.type === 'payout' ? styles.transactionAmountPositive : styles.transactionAmountNegative}`}>
              {txn.type === 'payout' ? '+' : '-'}{formatCurrency(txn.amount)}
            </span>
          </td>
          <td className={styles.tableCell}>
            <span className={styles.transactionDate}>{formatDate(txn.date)}</span>
          </td>
          <td className={styles.tableCell}>
            <span className={styles.transactionStatus}>Complété</span>
          </td>
          <td className={styles.tableCell}>
            <button className={styles.downloadBtn}>
              <Download />
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

interface MemberStatusCardProps {
  member: MemberPaymentStatus;
}

const MemberStatusCard: React.FC<MemberStatusCardProps> = ({ member }) => {
  const cardClass = member.isBeneficiary
    ? styles.memberCardBeneficiary
    : member.status === 'paid'
      ? styles.memberCardPaid
      : member.status === 'pending'
        ? styles.memberCardPending
        : styles.memberCardLate;

  const avatarClass = member.isBeneficiary
    ? styles.memberAvatarBeneficiary
    : member.status === 'paid'
      ? styles.memberAvatarPaid
      : member.status === 'pending'
        ? styles.memberAvatarPending
        : styles.memberAvatarLate;

  const statusClass = member.isBeneficiary
    ? styles.memberStatusBeneficiary
    : member.status === 'paid'
      ? styles.memberStatusPaid
      : member.status === 'pending'
        ? styles.memberStatusPending
        : styles.memberStatusLate;

  const statusText = member.isBeneficiary
    ? '🎉 Bénéficiaire'
    : member.status === 'paid'
      ? '✓ Payé'
      : member.status === 'pending'
        ? '⏳ En attente'
        : '⚠ Retard';

  return (
    <div className={`${styles.memberCard} ${cardClass}`}>
      <div className={`${styles.memberAvatar} ${avatarClass}`}>
        {member.initials}
      </div>
      <p className={`${styles.memberName} ${member.isBeneficiary ? styles.memberNameBold : ''}`}>
        {member.name}
      </p>
      <p className={`${styles.memberStatus} ${statusClass}`}>
        {statusText}
      </p>
    </div>
  );
};

interface QuickActionItemProps {
  action: QuickAction;
}

const QuickActionItem: React.FC<QuickActionItemProps> = ({ action }) => {
  const IconComponent = iconMap[action.icon];
  const iconColorClass = action.colorClass === 'primary'
    ? styles.quickActionIconPrimary
    : action.colorClass === 'secondary'
      ? styles.quickActionIconSecondary
      : action.colorClass === 'purple'
        ? styles.quickActionIconPurple
        : styles.quickActionIconGreen;

  return (
    <a href={action.href} className={styles.quickActionItem}>
      <div className={`${styles.quickActionIcon} ${iconColorClass}`}>
        {IconComponent && <IconComponent />}
      </div>
      <div className={styles.quickActionInfo}>
        <p className={styles.quickActionLabel}>{action.title}</p>
        <p className={styles.quickActionDescription}>{action.description}</p>
      </div>
    </a>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

export const Dashboard: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<string>(userGroups[0]?.id || '');
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'contributions' | 'payouts'>('all');

  const reliabilityProgress = (reliabilityStats.score / 100) * 251.2;

  return (
    <div className={styles.dashboardLayout}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.headerLeft}>
              <h1>Tableau de bord</h1>
              <p>Bienvenue, {currentUser.firstName} ! Voici un aperçu de vos tontines.</p>
            </div>

            <div className={styles.headerRight}>
              {/* Search */}
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className={styles.searchInput}
                />
              </div>

              {/* Notifications */}
              <button className={styles.notificationBtn}>
                <Bell />
                <span className={styles.notificationBadge}>3</span>
              </button>

              {/* CTA Button */}
              <button className={styles.ctaButton}>
                <Plus />
                Nouvelle cotisation
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className={styles.dashboardContent}>
          {/* ROW 1: STATS CARDS */}
          <div className={styles.statsGrid}>
            {/* Balance Card */}
            <div className={styles.balanceCard}>
              <div className={styles.balanceCardBgCircle1} />
              <div className={styles.balanceCardBgCircle2} />
              <div className={styles.balanceCardContent}>
                <div className={styles.balanceCardHeader}>
                  <div>
                    <p className={styles.balanceLabel}>Solde total des tontines</p>
                    <p className={styles.balanceAmount}>
                      {formatCurrency(dashboardStats.totalBalance).replace(' GNF', '')}
                      <span className={styles.balanceCurrency}> GNF</span>
                    </p>
                  </div>
                  <div className={styles.balanceIcon}>
                    <Wallet />
                  </div>
                </div>

                <div className={styles.balanceStats}>
                  <div className={styles.balanceStat}>
                    <span className={styles.balanceStatLabel}>Ce mois</span>
                    <span className={styles.balanceStatValue}>
                      +{formatCurrency(dashboardStats.monthlyChange)}
                    </span>
                  </div>
                  <div className={styles.balanceStatDivider} />
                  <div className={styles.balanceStat}>
                    <span className={styles.balanceStatLabel}>Évolution</span>
                    <div className={styles.trendPositive}>
                      <TrendingUp />
                      <span className={styles.balanceStatValue}>
                        +{dashboardStats.monthlyChangePercent}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contributions Card */}
            <div className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <div className={`${styles.statCardIcon} ${styles.statCardIconGreen}`}>
                  <ArrowUpCircle />
                </div>
                <span className={`${styles.statCardBadge} ${styles.statCardBadgeGreen}`}>
                  +3 ce mois
                </span>
              </div>
              <p className={styles.statCardLabel}>Cotisations effectuées</p>
              <p className={styles.statCardValue}>{dashboardStats.contributionsMade}</p>
              <p className={styles.statCardSubtext}>
                Total: <span className={styles.statCardSubtextHighlight}>
                  {formatCurrency(dashboardStats.contributionsTotal)}
                </span>
              </p>
            </div>

            {/* Pots Received Card */}
            <div className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <div className={`${styles.statCardIcon} ${styles.statCardIconSecondary}`}>
                  <ArrowDownCircle />
                </div>
                <span className={`${styles.statCardBadge} ${styles.statCardBadgeSecondary}`}>
                  {dashboardStats.potsReceived} tours
                </span>
              </div>
              <p className={styles.statCardLabel}>Cagnottes reçues</p>
              <p className={styles.statCardValue}>
                {formatCurrency(dashboardStats.potsTotal).replace(' GNF', '')}
                <span className={styles.statCardValueSmall}> GNF</span>
              </p>
              <p className={styles.statCardSubtext}>
                Prochain tour: <span className={styles.statCardSubtextSecondary}>15 Jan</span>
              </p>
            </div>
          </div>

          {/* ROW 2: GROUPS + UPCOMING */}
          <div className={styles.rowGrid}>
            {/* Groups List */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Mes Groupes de Tontine</h2>
                  <p className={styles.cardSubtitle}>{userGroups.length} groupes actifs</p>
                </div>
                <a href="/groups" className={styles.cardLink}>
                  Voir tout
                  <ArrowRight />
                </a>
              </div>

              <div>
                {userGroups.map((group, index) => (
                  <GroupListItem key={group.id} group={group} isYourTurn={index === 0} />
                ))}
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Prochaines échéances</h2>
                <a href="/calendar" className={styles.cardLink}>
                  Calendrier
                </a>
              </div>

              <div className={styles.deadlinesList}>
                {upcomingDeadlines.map((deadline) => (
                  <DeadlineItem key={deadline.id} deadline={deadline} />
                ))}
              </div>
            </div>
          </div>

          {/* ROW 3: TRANSACTIONS + STATS */}
          <div className={styles.rowGrid}>
            {/* Transactions Table */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Transactions récentes</h2>
                  <p className={styles.cardSubtitle}>Cotisations et versements</p>
                </div>
                <div className={styles.transactionsFilters}>
                  <button
                    className={`${styles.filterBtn} ${transactionFilter === 'all' ? styles.filterBtnActive : styles.filterBtnInactive}`}
                    onClick={() => setTransactionFilter('all')}
                  >
                    Tout
                  </button>
                  <button
                    className={`${styles.filterBtn} ${transactionFilter === 'contributions' ? styles.filterBtnActive : styles.filterBtnInactive}`}
                    onClick={() => setTransactionFilter('contributions')}
                  >
                    Cotisations
                  </button>
                  <button
                    className={`${styles.filterBtn} ${transactionFilter === 'payouts' ? styles.filterBtnActive : styles.filterBtnInactive}`}
                    onClick={() => setTransactionFilter('payouts')}
                  >
                    Versements
                  </button>
                </div>
              </div>

              <TransactionsTable />

              <div className={styles.tableFooter}>
                <a href="/transactions" className={styles.tableFooterLink}>
                  Voir toutes les transactions →
                </a>
              </div>
            </div>

            {/* Stats Sidebar */}
            <div className={styles.sidebarSpace}>
              {/* Reliability Score */}
              <div className={styles.reliabilityCard}>
                <h3 className={styles.reliabilityTitle}>Score de fiabilité</h3>
                <div className={styles.reliabilityChart}>
                  <div className={styles.reliabilityRing}>
                    <svg className={styles.reliabilityRingSvg} viewBox="0 0 100 100">
                      <defs>
                        <linearGradient id="reliabilityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#0D7377" />
                        </linearGradient>
                      </defs>
                      <circle
                        className={styles.reliabilityRingBg}
                        cx="50"
                        cy="50"
                        r="40"
                      />
                      <circle
                        className={styles.reliabilityRingProgress}
                        cx="50"
                        cy="50"
                        r="40"
                        strokeDasharray="251.2"
                        strokeDashoffset={251.2 - reliabilityProgress}
                      />
                    </svg>
                    <div className={styles.reliabilityCenter}>
                      <span className={styles.reliabilityScore}>{reliabilityStats.score}%</span>
                      <span className={styles.reliabilityRating}>{reliabilityStats.rating}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.reliabilityStats}>
                  <div className={styles.reliabilityStat}>
                    <span className={styles.reliabilityStatLabel}>Paiements à temps</span>
                    <span className={`${styles.reliabilityStatValue} ${styles.reliabilityStatValueGreen}`}>
                      {reliabilityStats.onTimePayments}/{reliabilityStats.totalPayments}
                    </span>
                  </div>
                  <div className={styles.reliabilityStat}>
                    <span className={styles.reliabilityStatLabel}>Retards</span>
                    <span className={styles.reliabilityStatValue}>{reliabilityStats.latePayments}</span>
                  </div>
                  <div className={styles.reliabilityStat}>
                    <span className={styles.reliabilityStatLabel}>Membre depuis</span>
                    <span className={styles.reliabilityStatValue}>{reliabilityStats.memberSinceMonths} mois</span>
                  </div>
                </div>
              </div>

              {/* Distribution */}
              <div className={styles.distributionCard}>
                <h3 className={styles.distributionTitle}>Répartition par groupe</h3>
                <div className={styles.distributionList}>
                  {groupDistribution.map((item) => (
                    <div key={item.groupId} className={styles.distributionItem}>
                      <div className={styles.distributionItemHeader}>
                        <span className={styles.distributionItemName}>{item.groupName}</span>
                        <span className={styles.distributionItemPercent}>{item.percentage}%</span>
                      </div>
                      <div className={styles.distributionItemBar}>
                        <div
                          className={styles.distributionItemFill}
                          style={{
                            width: `${item.percentage}%`,
                            background: item.color === 'secondary'
                              ? 'linear-gradient(90deg, #E8AA14, #F5C042)'
                              : item.color === 'purple'
                                ? 'linear-gradient(90deg, #a78bfa, #8b5cf6)'
                                : 'linear-gradient(90deg, #0D7377, #14919B)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ROW 4: MEMBERS STATUS + QUICK ACTIONS */}
          <div className={styles.rowGrid}>
            {/* Members Status */}
            <div className={`${styles.card} ${styles.membersStatusCard}`}>
              <div className={styles.cardHeader}>
                <div className={styles.membersStatusHeader}>
                  <h2 className={styles.cardTitle}>État des cotisations</h2>
                  <span className={styles.liveIndicator}>
                    <span className={styles.liveDot} />
                    En temps réel
                  </span>
                </div>
                <select
                  className={styles.groupSelect}
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  {userGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.cardBody}>
                <div className={styles.membersProgress}>
                  <div className={styles.membersProgressInfo}>
                    <div className={styles.membersProgressHeader}>
                      <span className={styles.membersProgressLabel}>Cotisations reçues ce tour</span>
                      <span className={styles.membersProgressValue}>16/20 membres</span>
                    </div>
                    <div className={styles.membersProgressBar}>
                      <div className={styles.membersProgressFill} style={{ width: '80%' }} />
                    </div>
                  </div>
                  <div className={styles.membersProgressTotal}>
                    <p className={styles.membersProgressTotalLabel}>Collecté</p>
                    <p className={styles.membersProgressTotalValue}>16 000 000 GNF</p>
                  </div>
                </div>

                <div className={styles.membersGrid}>
                  {membersPaymentStatus.map((member) => (
                    <MemberStatusCard key={member.userId} member={member} />
                  ))}
                  {/* Additional paid members indicator */}
                  <div className={`${styles.memberCard} ${styles.memberCardPaid}`}>
                    <div className={`${styles.memberAvatar} ${styles.memberAvatarPaid}`}>+11</div>
                    <p className={styles.memberName}>Autres</p>
                    <p className={`${styles.memberStatus} ${styles.memberStatusPaid}`}>✓ Payés</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className={styles.sidebarSpace}>
              {/* Payment CTA */}
              <div className={styles.paymentCtaCard}>
                <div className={styles.paymentCtaBg} />
                <div className={styles.paymentCtaContent}>
                  <div className={styles.paymentCtaIcon}>
                    <CreditCard />
                  </div>
                  <h3 className={styles.paymentCtaTitle}>Payer ma cotisation</h3>
                  <p className={styles.paymentCtaText}>
                    Effectuez votre paiement via Orange Money ou MTN MoMo
                  </p>
                  <button className={styles.paymentCtaButton}>
                    Payer maintenant
                  </button>
                </div>
              </div>

              {/* Quick Actions List */}
              <div className={styles.quickActionsCard}>
                <h3 className={styles.quickActionsTitle}>Actions rapides</h3>
                <div className={styles.quickActionsList}>
                  {quickActions.map((action) => (
                    <QuickActionItem key={action.id} action={action} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
