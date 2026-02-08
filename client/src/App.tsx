import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LanguageProvider } from "@/components/LanguageProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from '@/lib/auth';
import { LoginForm } from "@/components/LoginForm";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from '@/pages/dashboard';
import { ReservationsPage } from "@/pages/ReservationsPage";
import { AdminReservationsPage } from "@/pages/AdminReservationsPage";
import { ConsumptionsPage } from "@/pages/ConsumptionsPage";
import { ConsumptionsListPage } from "@/pages/ConsumptionsListPage";
import { MyConsumptionsPage } from '@/pages/MyConsumptionsPage';
import { MyReservationsPage } from '@/pages/MyReservationsPage';
import { CreditsPage } from "@/pages/CreditsPage";
import { MyDebtsPage } from "@/pages/MyDebtsPage";
import { UsersPage } from "@/pages/UsersPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { SocietyPage } from "@/pages/SocietyPage";
import { SepaExportPage } from "@/pages/SepaExportPage";
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
          <ProtectedRoute requiredAccess="admin">
            <AdminReservationsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/kontsumoak" component={ConsumptionsPage} />
      <Route path="/nire-konsumoak" component={MyConsumptionsPage} />
      <Route path="/nire-erreserbak" component={MyReservationsPage} />
      <Route path="/kontsumoak-zerrenda">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <ConsumptionsListPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/zorrak">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <CreditsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/nire-zorrak" component={MyDebtsPage} />
      <Route path="/oharrak">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <OharrakPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/jakinarazpenak" component={NotificationsPage} />
      <Route path="/profila" component={UserProfile} />
      <Route path="/erabiltzaileak">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <UsersPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/subscriptions">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <SubscriptionsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/produktuak">
        {() => (
          <ProtectedRoute requiredAccess="cellarman">
            <ProductsPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/mahaiak">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <TablesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/kategoriak">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <CategoriesPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/elkartea">
        {() => (
          <ProtectedRoute requiredAccess="treasurer">
            <SocietyPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/sepa">
        {() => (
          <ProtectedRoute requiredAccess="treasurer">
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
      return <BackofficeLayout>
        <Switch>
          <Route path="/elkarteapp/kudeaketa" component={BackofficeSocietiesPage} />
        </Switch>
      </BackofficeLayout>;
    }
    
    // All other backoffice routes use the backoffice layout
    return (
      <BackofficeLayout>
        <Switch>
          <Route path="/elkarteapp/kudeaketa/societies" component={BackofficeSocietiesPage} />
          <Route path="/elkarteapp/kudeaketa/superadmins" component={BackofficeSuperadminsPage} />
          <Route component={() => <div className="p-8"><h1>Page Not Found</h1><p>The requested backoffice page does not exist.</p></div>} />
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
