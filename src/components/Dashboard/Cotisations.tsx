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
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Smartphone,
  Building2,
  FileText,
  Eye,
  MoreVertical,
  CalendarDays,
  TrendingUp,
  Banknote,
  Receipt,
  ArrowRight,
  X,
} from 'lucide-react';

import styles from './Cotisations.module.css';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════════════ */

interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  initials: string;
}

type PaymentStatus = 'pending' | 'late' | 'paid' | 'upcoming';
type PaymentMethod = 'orange_money' | 'mtn_momo' | 'bank_transfer';

interface PendingContribution {
  id: string;
  groupId: string;
  groupName: string;
  groupColor: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: PaymentStatus;
  daysUntilDue: number;
  turnNumber: number;
  beneficiaryName: string;
  beneficiaryInitials: string;
}

interface ContributionHistory {
  id: string;
  groupId: string;
  groupName: string;
  amount: number;
  currency: string;
  date: Date;
  status: 'completed' | 'failed' | 'refunded';
  paymentMethod: PaymentMethod;
  transactionRef: string;
  turnNumber: number;
  type: 'contribution' | 'received';
}

interface UpcomingDeadline {
  id: string;
  groupName: string;
  amount: number;
  dueDate: Date;
  daysUntil: number;
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

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════════════════════════════════════ */

const currentUser: User = {
  id: 'user-001',
  firstName: 'Elhadj',
  lastName: 'Mamadou',
  phone: '+224 621 00 00 00',
  initials: 'EM',
};

const pendingContributions: PendingContribution[] = [
  {
    id: 'contrib-001',
    groupId: 'group-002',
    groupName: 'Tontine Famille Diallo',
    groupColor: 'primary',
    amount: 500000,
    currency: 'GNF',
    dueDate: new Date('2025-01-15'),
    status: 'pending',
    daysUntilDue: 12,
    turnNumber: 9,
    beneficiaryName: 'Kadiatou Diallo',
    beneficiaryInitials: 'KD',
  },
  {
    id: 'contrib-002',
    groupId: 'group-004',
    groupName: 'Entrepreneurs Kaloum',
    groupColor: 'blue',
    amount: 2000000,
    currency: 'GNF',
    dueDate: new Date('2025-01-10'),
    status: 'late',
    daysUntilDue: -3,
    turnNumber: 5,
    beneficiaryName: 'Alpha Barry',
    beneficiaryInitials: 'AB',
  },
];

const upcomingDeadlines: UpcomingDeadline[] = [
  { id: 'dl-1', groupName: 'Entrepreneurs Kaloum', amount: 2000000, dueDate: new Date('2025-01-10'), daysUntil: -3 },
  { id: 'dl-2', groupName: 'Famille Diallo', amount: 500000, dueDate: new Date('2025-01-15'), daysUntil: 12 },
  { id: 'dl-3', groupName: 'Collègues Bureau', amount: 200000, dueDate: new Date('2025-02-01'), daysUntil: 29 },
  { id: 'dl-4', groupName: 'Commerçants Madina', amount: 1000000, dueDate: new Date('2025-02-08'), daysUntil: 36 },
];

const contributionHistory: ContributionHistory[] = [
  {
    id: 'hist-001',
    groupId: 'group-001',
    groupName: 'Commerçants Madina',
    amount: 1000000,
    currency: 'GNF',
    date: new Date('2024-12-29'),
    status: 'completed',
    paymentMethod: 'orange_money',
    transactionRef: 'TXN-2024-1229-89012',
    turnNumber: 7,
    type: 'contribution',
  },
  {
    id: 'hist-002',
    groupId: 'group-002',
    groupName: 'Famille Diallo',
    amount: 6000000,
    currency: 'GNF',
    date: new Date('2024-12-25'),
    status: 'completed',
    paymentMethod: 'orange_money',
    transactionRef: 'TXN-2024-1225-78421',
    turnNumber: 3,
    type: 'received',
  },
  {
    id: 'hist-003',
    groupId: 'group-002',
    groupName: 'Famille Diallo',
    amount: 500000,
    currency: 'GNF',
    date: new Date('2024-12-15'),
    status: 'completed',
    paymentMethod: 'orange_money',
    transactionRef: 'TXN-2024-1215-45678',
    turnNumber: 8,
    type: 'contribution',
  },
  {
    id: 'hist-004',
    groupId: 'group-003',
    groupName: 'Collègues Bureau',
    amount: 200000,
    currency: 'GNF',
    date: new Date('2024-12-01'),
    status: 'completed',
    paymentMethod: 'mtn_momo',
    transactionRef: 'TXN-2024-1201-12345',
    turnNumber: 2,
    type: 'contribution',
  },
  {
    id: 'hist-005',
    groupId: 'group-001',
    groupName: 'Commerçants Madina',
    amount: 1000000,
    currency: 'GNF',
    date: new Date('2024-11-22'),
    status: 'completed',
    paymentMethod: 'orange_money',
    transactionRef: 'TXN-2024-1122-67890',
    turnNumber: 6,
    type: 'contribution',
  },
  {
    id: 'hist-006',
    groupId: 'group-004',
    groupName: 'Entrepreneurs Kaloum',
    amount: 2000000,
    currency: 'GNF',
    date: new Date('2024-11-10'),
    status: 'completed',
    paymentMethod: 'orange_money',
    transactionRef: 'TXN-2024-1110-34567',
    turnNumber: 4,
    type: 'contribution',
  },
];

const navigationSections: NavSection[] = [
  {
    id: 'main',
    title: 'Menu principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'LayoutDashboard', href: '/dashboard' },
      { id: 'groups', label: 'Mes groupes', icon: 'Users', href: '/groups', badge: 5 },
      { id: 'contributions', label: 'Cotisations', icon: 'Wallet', href: '/contributions', isActive: true },
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

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-GN').format(amount);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatShortDate = (date: Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(date);
};

const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    orange_money: 'Orange Money',
    mtn_momo: 'MTN MoMo',
    bank_transfer: 'Virement',
  };
  return labels[method];
};

const getPaymentMethodIcon = (method: PaymentMethod) => {
  switch (method) {
    case 'orange_money':
    case 'mtn_momo':
      return Smartphone;
    case 'bank_transfer':
      return Building2;
    default:
      return CreditCard;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   ICON MAP
═══════════════════════════════════════════════════════════════════════════ */

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Wallet, Repeat, History, Calendar,
  PlusCircle, UserPlus, Send, User, Settings, Bell, HelpCircle,
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

const Sidebar: React.FC = () => (
  <aside className={styles.sidebar}>
    <div className={styles.logoSection}>
      <a href="/" className={styles.logoLink}>
        <div className={styles.logoIcon}><TontineLogo /></div>
        <div>
          <span className={styles.logoText}>Tontine</span>
          <span className={`${styles.logoText} ${styles.logoTextAccent}`}> Digital</span>
        </div>
      </a>
    </div>

    <nav className={styles.nav}>
      {navigationSections.map((section) => (
        <div key={section.id} className={styles.navSection}>
          <span className={styles.navSectionLabel}>{section.title}</span>
          <ul className={styles.navList}>
            {section.items.map((item) => {
              const Icon = iconMap[item.icon];
              return (
                <li key={item.id}>
                  <a href={item.href} className={`${styles.navLink} ${item.isActive ? styles.navLinkActive : ''}`}>
                    {Icon && <Icon className={styles.navLinkIcon} />}
                    <span>{item.label}</span>
                    {typeof item.badge === 'number' && <span className={styles.navBadge}>{item.badge}</span>}
                    {item.badge === '•' && <span className={styles.navDot} />}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>

    <div className={styles.userBlock}>
      <div className={styles.userAvatar}>{currentUser.initials}</div>
      <div className={styles.userMeta}>
        <span className={styles.userMetaName}>{currentUser.firstName} {currentUser.lastName}</span>
        <span className={styles.userMetaPhone}>{currentUser.phone}</span>
      </div>
      <ChevronDown className={styles.userChevron} />
    </div>
  </aside>
);

/* ═══════════════════════════════════════════════════════════════════════════
   SUMMARY CARD COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  variant?: 'default' | 'warning' | 'success';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, subtitle, variant = 'default' }) => (
  <div className={`${styles.summaryCard} ${styles[`summaryCard${variant.charAt(0).toUpperCase() + variant.slice(1)}`]}`}>
    <div className={styles.summaryCardIcon}>{icon}</div>
    <div className={styles.summaryCardContent}>
      <span className={styles.summaryCardLabel}>{label}</span>
      <span className={styles.summaryCardValue}>{value}</span>
      {subtitle && <span className={styles.summaryCardSubtitle}>{subtitle}</span>}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   PENDING CONTRIBUTION CARD
═══════════════════════════════════════════════════════════════════════════ */

interface PendingCardProps {
  contribution: PendingContribution;
  onPay: (id: string) => void;
}

const PendingCard: React.FC<PendingCardProps> = ({ contribution, onPay }) => {
  const isLate = contribution.status === 'late';
  
  return (
    <div className={`${styles.pendingCard} ${isLate ? styles.pendingCardLate : ''}`}>
      {isLate && (
        <div className={styles.lateRibbon}>
          <AlertCircle />
          <span>En retard de {Math.abs(contribution.daysUntilDue)} jours</span>
        </div>
      )}
      
      <div className={styles.pendingCardBody}>
        <div className={styles.pendingCardLeft}>
          <div className={`${styles.pendingGroupDot} ${styles[contribution.groupColor]}`} />
          <div className={styles.pendingCardInfo}>
            <h4 className={styles.pendingGroupName}>{contribution.groupName}</h4>
            <p className={styles.pendingTurnInfo}>
              Tour #{contribution.turnNumber} · Bénéficiaire: {contribution.beneficiaryName}
            </p>
          </div>
        </div>
        
        <div className={styles.pendingCardCenter}>
          <div className={styles.pendingDateBlock}>
            <CalendarDays className={styles.pendingDateIcon} />
            <div>
              <span className={styles.pendingDateLabel}>Échéance</span>
              <span className={`${styles.pendingDateValue} ${isLate ? styles.pendingDateLate : ''}`}>
                {formatShortDate(contribution.dueDate)}
              </span>
            </div>
          </div>
        </div>
        
        <div className={styles.pendingCardRight}>
          <div className={styles.pendingAmount}>
            <span className={styles.pendingAmountValue}>{formatCurrency(contribution.amount)}</span>
            <span className={styles.pendingAmountCurrency}>{contribution.currency}</span>
          </div>
          <button className={styles.payButton} onClick={() => onPay(contribution.id)}>
            <Wallet />
            <span>Payer</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   TIMELINE COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

const Timeline: React.FC<{ deadlines: UpcomingDeadline[] }> = ({ deadlines }) => (
  <div className={styles.timeline}>
    {deadlines.map((d, index) => {
      const isLate = d.daysUntil < 0;
      const isUrgent = d.daysUntil >= 0 && d.daysUntil <= 7;
      
      return (
        <div key={d.id} className={styles.timelineItem}>
          <div className={`${styles.timelineDot} ${isLate ? styles.timelineDotLate : isUrgent ? styles.timelineDotUrgent : ''}`} />
          {index < deadlines.length - 1 && <div className={styles.timelineLine} />}
          <div className={styles.timelineContent}>
            <span className={`${styles.timelineDate} ${isLate ? styles.timelineDateLate : isUrgent ? styles.timelineDateUrgent : ''}`}>
              {isLate ? `${Math.abs(d.daysUntil)}j de retard` : d.daysUntil === 0 ? "Aujourd'hui" : `${d.daysUntil}j`}
            </span>
            <span className={styles.timelineGroup}>{d.groupName}</span>
            <span className={styles.timelineAmount}>{formatCurrency(d.amount)} GNF</span>
          </div>
        </div>
      );
    })}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORY TABLE
═══════════════════════════════════════════════════════════════════════════ */

interface HistoryTableProps {
  data: ContributionHistory[];
  filter: 'all' | 'contributions' | 'received';
}

const HistoryTable: React.FC<HistoryTableProps> = ({ data, filter }) => {
  const filteredData = useMemo(() => {
    if (filter === 'all') return data;
    return data.filter(d => d.type === (filter === 'contributions' ? 'contribution' : 'received'));
  }, [data, filter]);

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Groupe</th>
            <th>Montant</th>
            <th>Date</th>
            <th>Méthode</th>
            <th>Référence</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((item) => {
            const MethodIcon = getPaymentMethodIcon(item.paymentMethod);
            const isReceived = item.type === 'received';
            
            return (
              <tr key={item.id}>
                <td>
                  <div className={styles.transactionCell}>
                    <div className={`${styles.transactionIcon} ${isReceived ? styles.transactionIconReceived : styles.transactionIconPaid}`}>
                      {isReceived ? <ArrowDownLeft /> : <ArrowUpRight />}
                    </div>
                    <div>
                      <span className={styles.transactionType}>{isReceived ? 'Cagnotte reçue' : 'Cotisation payée'}</span>
                      <span className={styles.transactionTurn}>Tour #{item.turnNumber}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={styles.groupCell}>{item.groupName}</span>
                </td>
                <td>
                  <span className={`${styles.amountCell} ${isReceived ? styles.amountPositive : ''}`}>
                    {isReceived ? '+' : '-'}{formatCurrency(item.amount)} GNF
                  </span>
                </td>
                <td>
                  <span className={styles.dateCell}>{formatDate(item.date)}</span>
                </td>
                <td>
                  <div className={styles.methodCell}>
                    <MethodIcon />
                    <span>{getPaymentMethodLabel(item.paymentMethod)}</span>
                  </div>
                </td>
                <td>
                  <span className={styles.refCell}>{item.transactionRef}</span>
                </td>
                <td>
                  <button className={styles.tableAction} title="Télécharger le reçu">
                    <Download />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COTISATIONS COMPONENT
═══════════════════════════════════════════════════════════════════════════ */

export const Cotisations: React.FC = () => {
  const [historyFilter, setHistoryFilter] = useState<'all' | 'contributions' | 'received'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calculate summary stats
  const totalPending = pendingContributions.reduce((sum, c) => sum + c.amount, 0);
  const lateCount = pendingContributions.filter(c => c.status === 'late').length;
  const totalPaidThisMonth = contributionHistory
    .filter(h => h.type === 'contribution' && h.date.getMonth() === new Date().getMonth())
    .reduce((sum, h) => sum + h.amount, 0);
  const totalReceivedThisYear = contributionHistory
    .filter(h => h.type === 'received')
    .reduce((sum, h) => sum + h.amount, 0);

  return (
    <div className={styles.layout}>
      <Sidebar />
      
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.headerTitle}>Cotisations</h1>
              <p className={styles.headerSubtitle}>Gérez vos paiements et consultez votre historique</p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.searchBox}>
                <Search />
                <input 
                  type="text" 
                  placeholder="Rechercher une transaction..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className={styles.headerBtn}>
                <Download />
                <span>Exporter</span>
              </button>
            </div>
          </div>
        </header>
        
        <div className={styles.content}>
          {/* Summary Section */}
          <section className={styles.summarySection}>
            <SummaryCard
              icon={<Banknote />}
              label="À payer"
              value={`${formatCurrency(totalPending)} GNF`}
              subtitle={`${pendingContributions.length} cotisation${pendingContributions.length > 1 ? 's' : ''} en attente`}
              variant={lateCount > 0 ? 'warning' : 'default'}
            />
            <SummaryCard
              icon={<TrendingUp />}
              label="Payé ce mois"
              value={`${formatCurrency(totalPaidThisMonth)} GNF`}
              subtitle="Janvier 2025"
              variant="default"
            />
            <SummaryCard
              icon={<Receipt />}
              label="Cagnottes reçues"
              value={`${formatCurrency(totalReceivedThisYear)} GNF`}
              subtitle="Cette année"
              variant="success"
            />
            <SummaryCard
              icon={<Clock />}
              label="Prochaine échéance"
              value={formatShortDate(upcomingDeadlines.find(d => d.daysUntil >= 0)?.dueDate || new Date())}
              subtitle={upcomingDeadlines.find(d => d.daysUntil >= 0)?.groupName || '—'}
              variant="default"
            />
          </section>
          
          {/* Pending Contributions */}
          {pendingContributions.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className={styles.sectionTitle}>Cotisations en attente</h2>
                  <p className={styles.sectionSubtitle}>
                    {lateCount > 0 && <span className={styles.alertText}>{lateCount} paiement{lateCount > 1 ? 's' : ''} en retard</span>}
                    {lateCount === 0 && `${pendingContributions.length} paiement${pendingContributions.length > 1 ? 's' : ''} à effectuer`}
                  </p>
                </div>
                {pendingContributions.length > 1 && (
                  <button className={styles.payAllBtn}>
                    <Wallet />
                    <span>Tout payer ({formatCurrency(totalPending)} GNF)</span>
                  </button>
                )}
              </div>
              
              <div className={styles.pendingList}>
                {pendingContributions
                  .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
                  .map(contrib => (
                    <PendingCard 
                      key={contrib.id} 
                      contribution={contrib} 
                      onPay={(id) => console.log('Pay:', id)}
                    />
                  ))}
              </div>
            </section>
          )}
          
          {/* Upcoming Timeline */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Échéancier</h2>
                <p className={styles.sectionSubtitle}>Prochaines cotisations à venir</p>
              </div>
              <a href="/calendar" className={styles.sectionLink}>
                Voir le calendrier <ChevronRight />
              </a>
            </div>
            <Timeline deadlines={upcomingDeadlines} />
          </section>
          
          {/* History */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Historique des transactions</h2>
                <p className={styles.sectionSubtitle}>{contributionHistory.length} transactions</p>
              </div>
              <div className={styles.filterTabs}>
                <button 
                  className={`${styles.filterTab} ${historyFilter === 'all' ? styles.filterTabActive : ''}`}
                  onClick={() => setHistoryFilter('all')}
                >
                  Tout
                </button>
                <button 
                  className={`${styles.filterTab} ${historyFilter === 'contributions' ? styles.filterTabActive : ''}`}
                  onClick={() => setHistoryFilter('contributions')}
                >
                  Cotisations
                </button>
                <button 
                  className={`${styles.filterTab} ${historyFilter === 'received' ? styles.filterTabActive : ''}`}
                  onClick={() => setHistoryFilter('received')}
                >
                  Reçus
                </button>
              </div>
            </div>
            <HistoryTable data={contributionHistory} filter={historyFilter} />
          </section>
        </div>
      </main>
    </div>
  );
};

export default Cotisations;