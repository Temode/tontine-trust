import { lazy, Suspense } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteBoundary } from "@/components/RouteBoundary";
import { logCrash } from "@/lib/diagnostics/crashLogger";

// Lazy-loaded pages : un import cassé n'efface plus toute l'app.
const Auth = lazy(() => import("@/pages/Auth"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const Index = lazy(() => import("@/pages/Index"));
const CreateGroup = lazy(() => import("@/pages/CreateGroup"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const GroupDetail = lazy(() => import("@/pages/GroupDetail"));
const InviteMembers = lazy(() => import("@/pages/InviteMembers"));
const JoinGroup = lazy(() => import("@/pages/JoinGroup"));
const MyGroups = lazy(() => import("@/pages/MyGroups"));
const MyContributions = lazy(() => import("@/pages/MyContributions"));
const Receipts = lazy(() => import("@/pages/Receipts"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Messages = lazy(() => import("@/pages/Messages"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Profile = lazy(() => import("@/pages/Profile"));
const GroupSettings = lazy(() => import("@/pages/GroupSettings"));
const GroupCoOrganizers = lazy(() => import("@/pages/GroupCoOrganizers"));
const GroupMembers = lazy(() => import("@/pages/GroupMembers"));
const NotificationPreferences = lazy(() => import("@/pages/NotificationPreferences"));
const PrivacySettings = lazy(() => import("@/pages/PrivacySettings"));
const DeleteAccount = lazy(() => import("@/pages/DeleteAccount"));
const PaymentReturn = lazy(() => import("@/pages/PaymentReturn"));
const PaymentCancel = lazy(() => import("@/pages/PaymentCancel"));
const PaymentReceipt = lazy(() => import("@/pages/PaymentReceipt"));
const MyBalance = lazy(() => import("@/pages/MyBalance"));
const AdminOverview = lazy(() => import("@/pages/admin/Overview"));
const AdminDeletions = lazy(() => import("@/pages/admin/Deletions"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminGroups = lazy(() => import("@/pages/admin/Groups"));
const AdminPayments = lazy(() => import("@/pages/admin/Payments"));
const AdminAudit = lazy(() => import("@/pages/admin/Audit"));
const AdminIntegrity = lazy(() => import("@/pages/admin/Integrity"));
const AdminDjomySettings = lazy(() => import("@/pages/admin/DjomySettings"));
const AdminSmsTest = lazy(() => import("@/pages/admin/SmsTest"));
const AdminSmsLogs = lazy(() => import("@/pages/admin/SmsLogs"));
const AdminCronPreview = lazy(() => import("@/pages/admin/CronPreview"));
const AdminDefaulters = lazy(() => import("@/pages/admin/Defaulters"));
const AdminKycReview = lazy(() => import("@/pages/admin/KycReview"));
const Kyc = lazy(() => import("@/pages/Kyc"));
const AdminDeposits = lazy(() => import("@/pages/admin/Deposits"));
const DepositPayment = lazy(() => import("@/pages/DepositPayment"));
const AdminContractTemplate = lazy(() => import("@/pages/admin/ContractTemplate"));
const AdminPayoutHolds = lazy(() => import("@/pages/admin/PayoutHolds"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/Subscriptions"));
const AdminSmsPricing = lazy(() => import("@/pages/admin/SmsPricing"));
const AdminSmsOrders = lazy(() => import("@/pages/admin/SmsOrders"));
const Subscription = lazy(() => import("@/pages/Subscription"));
import { AdminShell } from "@/components/admin/AdminShell";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
    mutations: { retry: 0 },
  },
  queryCache: new QueryCache({
    onError: (error, query) =>
      logCrash({ source: "react-query", error, extra: { queryKey: query.queryKey } }),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) =>
      logCrash({
        source: "react-query",
        error,
        extra: { mutationKey: mutation.options.mutationKey ?? null },
      }),
  }),
});

function AppSuspense() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

const App = () => (
  <ErrorBoundary fallbackTitle="Tontine Digital a rencontré un problème">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<AppSuspense />}>
              <Routes>
                <Route
                  path="/"
                  element={
                    <RouteBoundary name="Accueil">
                      <Index />
                    </RouteBoundary>
                  }
                />
                <Route
                  path="/auth"
                  element={
                    <RouteBoundary name="Connexion">
                      <Auth />
                    </RouteBoundary>
                  }
                />
                <Route
                  path="/auth/mot-de-passe-oublie"
                  element={
                    <RouteBoundary name="Mot de passe oublié">
                      <ForgotPassword />
                    </RouteBoundary>
                  }
                />
                <Route
                  path="/auth/reinitialiser"
                  element={
                    <RouteBoundary name="Nouveau mot de passe">
                      <ResetPassword />
                    </RouteBoundary>
                  }
                />
                <Route
                  path="/auth/verifier-email"
                  element={
                    <RouteBoundary name="Vérification email">
                      <VerifyEmail />
                    </RouteBoundary>
                  }
                />
                <Route element={<ProtectedRoute />}>
                  <Route
                    element={
                      <AppShell>
                        <Outlet />
                      </AppShell>
                    }
                  >
                    <Route path="/dashboard" element={<RouteBoundary name="Tableau de bord"><Dashboard /></RouteBoundary>} />
                    <Route path="/groupes" element={<RouteBoundary name="Mes groupes"><MyGroups /></RouteBoundary>} />
                    <Route path="/groupes/:id" element={<RouteBoundary name="Détail du groupe"><GroupDetail /></RouteBoundary>} />
                    <Route path="/groupes/:id/parametres" element={<RouteBoundary name="Paramètres du groupe"><GroupSettings /></RouteBoundary>} />
                    <Route path="/groupes/:id/co-organisateurs" element={<RouteBoundary name="Co-organisateurs"><GroupCoOrganizers /></RouteBoundary>} />
                    <Route path="/groupes/:id/membres" element={<RouteBoundary name="Gérer les membres"><GroupMembers /></RouteBoundary>} />
                   <Route path="/groupes/:id/caution" element={<RouteBoundary name="Dépôt de caution"><DepositPayment /></RouteBoundary>} />
                    <Route path="/cotisations" element={<RouteBoundary name="Mes cotisations"><MyContributions /></RouteBoundary>} />
                    <Route path="/solde" element={<RouteBoundary name="Mon solde"><MyBalance /></RouteBoundary>} />
                    <Route path="/recus" element={<RouteBoundary name="Reçus"><Receipts /></RouteBoundary>} />
                    <Route path="/recus/:id" element={<RouteBoundary name="Reçu"><Receipts /></RouteBoundary>} />
                    <Route path="/notifications" element={<RouteBoundary name="Notifications"><Notifications /></RouteBoundary>} />
                    <Route path="/discussions" element={<RouteBoundary name="Discussions"><Messages /></RouteBoundary>} />
                    <Route path="/discussions/:groupId" element={<RouteBoundary name="Discussion"><Messages /></RouteBoundary>} />
                    <Route path="/nouveau" element={<RouteBoundary name="Créer un groupe"><CreateGroup /></RouteBoundary>} />
                    <Route path="/abonnement" element={<RouteBoundary name="Abonnement"><Subscription /></RouteBoundary>} />
                    <Route path="/rejoindre" element={<RouteBoundary name="Rejoindre un groupe"><JoinGroup /></RouteBoundary>} />
                    <Route path="/inviter" element={<RouteBoundary name="Inviter"><InviteMembers /></RouteBoundary>} />
                    <Route path="/profil" element={<RouteBoundary name="Profil"><Profile /></RouteBoundary>} />
                    <Route path="/parametres/notifications" element={<RouteBoundary name="Préférences notifications"><NotificationPreferences /></RouteBoundary>} />
                    <Route path="/profil/confidentialite" element={<RouteBoundary name="Confidentialité"><PrivacySettings /></RouteBoundary>} />
                    <Route path="/profil/suppression" element={<RouteBoundary name="Supprimer mon compte"><DeleteAccount /></RouteBoundary>} />
                    <Route path="/profil/kyc" element={<RouteBoundary name="Vérification d'identité"><Kyc /></RouteBoundary>} />
                    <Route path="/payment/return" element={<RouteBoundary name="Retour paiement"><PaymentReturn /></RouteBoundary>} />
                    <Route path="/paiement/retour" element={<RouteBoundary name="Retour paiement"><PaymentReturn /></RouteBoundary>} />
                    <Route path="/payment/cancel" element={<RouteBoundary name="Paiement annulé"><PaymentCancel /></RouteBoundary>} />
                    <Route path="/paiement/:paymentId/recu" element={<RouteBoundary name="Preuve de paiement"><PaymentReceipt /></RouteBoundary>} />
                  </Route>
                  <Route
                    element={
                      <AdminShell>
                        <Outlet />
                      </AdminShell>
                    }
                  >
                    <Route path="/admin" element={<RouteBoundary name="Admin"><AdminOverview /></RouteBoundary>} />
                    <Route path="/admin/overview" element={<RouteBoundary name="Admin overview"><AdminOverview /></RouteBoundary>} />
                    <Route path="/admin/suppressions" element={<RouteBoundary name="Admin suppressions"><AdminDeletions /></RouteBoundary>} />
                    <Route path="/admin/utilisateurs" element={<RouteBoundary name="Admin utilisateurs"><AdminUsers /></RouteBoundary>} />
                    <Route path="/admin/groupes" element={<RouteBoundary name="Admin groupes"><AdminGroups /></RouteBoundary>} />
                    <Route path="/admin/paiements" element={<RouteBoundary name="Admin paiements"><AdminPayments /></RouteBoundary>} />
                    <Route path="/admin/audit" element={<RouteBoundary name="Admin audit"><AdminAudit /></RouteBoundary>} />
                    <Route path="/admin/integrite" element={<RouteBoundary name="Intégrité tontine"><AdminIntegrity /></RouteBoundary>} />
                    <Route path="/admin/djomy" element={<RouteBoundary name="Identifiants Djomy"><AdminDjomySettings /></RouteBoundary>} />
                    <Route path="/admin/sms-test" element={<RouteBoundary name="Test SMS"><AdminSmsTest /></RouteBoundary>} />
                    <Route path="/admin/sms-logs" element={<RouteBoundary name="Journal SMS"><AdminSmsLogs /></RouteBoundary>} />
                    <Route path="/admin/cron-preview" element={<RouteBoundary name="Aperçu cron rappels"><AdminCronPreview /></RouteBoundary>} />
                    <Route path="/admin/defaillants" element={<RouteBoundary name="Défaillants"><AdminDefaulters /></RouteBoundary>} />
                    <Route path="/admin/kyc" element={<RouteBoundary name="Vérifications KYC"><AdminKycReview /></RouteBoundary>} />
                    <Route path="/admin/cautions" element={<RouteBoundary name="Cautions"><AdminDeposits /></RouteBoundary>} />
                    <Route path="/admin/contrat" element={<RouteBoundary name="Modèle de contrat"><AdminContractTemplate /></RouteBoundary>} />
                    <Route path="/admin/retentions" element={<RouteBoundary name="Rétentions payout"><AdminPayoutHolds /></RouteBoundary>} />
                    <Route path="/admin/subscriptions" element={<RouteBoundary name="Plans d'abonnement"><AdminSubscriptions /></RouteBoundary>} />
                    <Route path="/admin/sms-pricing" element={<RouteBoundary name="Tarification SMS"><AdminSmsPricing /></RouteBoundary>} />
                    <Route path="/admin/sms-orders" element={<RouteBoundary name="Commandes SMS"><AdminSmsOrders /></RouteBoundary>} />
                  </Route>
                </Route>
                <Route path="*" element={<RouteBoundary name="Page introuvable"><NotFound /></RouteBoundary>} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
