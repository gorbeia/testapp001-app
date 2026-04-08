import React from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LanguageProvider } from "@/components/LanguageProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { Permission } from "@shared/permissions";
import { LoginForm } from "@/components/LoginForm";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { PrepaymentLedgerBanner } from "@/components/PrepaymentLedgerBanner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from "@/pages/dashboard";
import { ReservationsPage } from "@/pages/ReservationsPage";
import { AdminReservationsPage } from "@/pages/AdminReservationsPage";
import { ConsumptionsPage } from "@/pages/ConsumptionsPage";
import { ConsumptionsListPage } from "@/pages/ConsumptionsListPage";
import { MyConsumptionsPage } from "@/pages/MyConsumptionsPage";
import { MyReservationsPage } from "@/pages/MyReservationsPage";
import { CreditsPage } from "@/pages/CreditsPage";
import { MyDebtsPage } from "@/pages/MyDebtsPage";
import { UsersPage } from "@/pages/UsersPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { StockChangesPage } from "@/pages/StockChangesPage";
import { StockReceiptsPage } from "@/pages/StockReceiptsPage";
import { StockTakePage } from "@/pages/StockTakePage";
import { SocietyPage } from "@/pages/SocietyPage";
import { SepaExportPage } from "@/pages/SepaExportPage";
import { MyMovementsPage } from "@/pages/MyMovementsPage";
import { AccountMovementsPage } from "@/pages/AccountMovementsPage";
import { SocietyAccountingPage } from "@/pages/SocietyAccountingPage";
import { BankTransfersPage } from "@/pages/BankTransfersPage";
import { TablesPage } from "@/pages/TablesPage";
import { UserProfile } from "@/components/UserProfile";
import OharrakPage from "@/pages/announcements";
import NotificationsPage from "@/pages/NotificationsPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import CategoriesPage from "@/pages/CategoriesPage";
import NotFound from "@/pages/not-found";
import { SuperAdminLoginPage } from "@/pages/SuperAdminLoginPage";
import { BackofficeSocietiesPage, BackofficeSuperadminsPage, BackofficeLayout } from "@/backoffice";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/erreserbak" component={ReservationsPage} />
      <Route path="/admin-erreserbak">
        {() => (
          <ProtectedRoute requires={Permission.RESERVATIONS_REGISTRY}>
            <AdminReservationsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/kontsumoak" component={ConsumptionsPage} />
      <Route path="/nire-konsumoak" component={MyConsumptionsPage} />
      <Route path="/nire-erreserbak" component={MyReservationsPage} />
      <Route path="/kontsumoak-zerrenda">
        {() => (
          <ProtectedRoute requires={Permission.CONSUMPTIONS_ADMIN}>
            <ConsumptionsListPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/zorrak">
        {() => (
          <ProtectedRoute requires={Permission.CREDITS_VIEW}>
            <CreditsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/nire-zorrak" component={MyDebtsPage} />
      <Route path="/nire-mugimenduak" component={MyMovementsPage} />
      <Route path="/mugimenduak">
        {() => (
          <ProtectedRoute requires={Permission.MOVEMENTS_VIEW}>
            <AccountMovementsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/kontabilitatea">
        {() => (
          <ProtectedRoute requires={Permission.MOVEMENTS_VIEW}>
            <SocietyAccountingPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/transferentziak">
        {() => (
          <ProtectedRoute requires={Permission.BANK_TRANSFERS_MANAGE}>
            <BankTransfersPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/itzulketak">
        {() => (
          <ProtectedRoute requires={Permission.BANK_TRANSFERS_MANAGE}>
            <Redirect to="/transferentziak" />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/oharrak">
        {() => (
          <ProtectedRoute requires={Permission.NOTES_MANAGE}>
            <OharrakPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/jakinarazpenak" component={NotificationsPage} />
      <Route path="/profila" component={UserProfile} />
      <Route path="/erabiltzaileak">
        {() => (
          <ProtectedRoute requires={Permission.USERS_MANAGE}>
            <UsersPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/subscriptions">
        {() => (
          <ProtectedRoute requires={Permission.SUBSCRIPTIONS_MANAGE}>
            <SubscriptionsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/produktuak">
        {() => (
          <ProtectedRoute requires={Permission.PRODUCTS_MANAGE}>
            <ProductsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/stock-aldaketak">
        {() => (
          <ProtectedRoute requires={Permission.PRODUCTS_MANAGE}>
            <StockChangesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/hornidurak">
        {() => (
          <ProtectedRoute requires={Permission.PRODUCTS_MANAGE}>
            <StockReceiptsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/inbentarioa">
        {() => (
          <ProtectedRoute requires={Permission.PRODUCTS_MANAGE}>
            <StockTakePage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/mahaiak">
        {() => (
          <ProtectedRoute requires={Permission.TABLES_MANAGE}>
            <TablesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/kategoriak">
        {() => (
          <ProtectedRoute requires={Permission.CATEGORIES_MANAGE}>
            <CategoriesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/elkartea">
        {() => (
          <ProtectedRoute requires={Permission.SOCIETY_MANAGE}>
            <SocietyPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sepa">
        {() => (
          <ProtectedRoute requires={Permission.SEPA_EXPORT}>
            <SepaExportPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  // Multisociety management area (superadmin), independent of society-based layout
  // All pages under /elkarteapp/kudeaketa* use their own UI with the backoffice sidebar.
  if (location.startsWith("/elkarteapp/kudeaketa")) {
    // Login page doesn't use the backoffice layout
    if (location === "/elkarteapp/kudeaketa/login") {
      return <SuperAdminLoginPage />;
    }

    // Redirect base URL to societies page
    if (location === "/elkarteapp/kudeaketa") {
      return (
        <BackofficeLayout>
          <Switch>
            <Route path="/elkarteapp/kudeaketa" component={BackofficeSocietiesPage} />
          </Switch>
        </BackofficeLayout>
      );
    }

    // All other backoffice routes use the backoffice layout
    return (
      <BackofficeLayout>
        <Switch>
          <Route path="/elkarteapp/kudeaketa/societies" component={BackofficeSocietiesPage} />
          <Route path="/elkarteapp/kudeaketa/superadmins" component={BackofficeSuperadminsPage} />
          <Route
            component={() => (
              <div className="p-8">
                <h1>Page Not Found</h1>
                <p>The requested backoffice page does not exist.</p>
              </div>
            )}
          />
        </Switch>
      </BackofficeLayout>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />
          <PrepaymentLedgerBanner />
          <main className="flex-1 overflow-auto">
            <AppRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <AuthenticatedApp />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
