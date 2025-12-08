import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LanguageProvider } from "@/components/LanguageProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from "@/components/Dashboard";
import { ReservationsPage } from "@/components/ReservationsPage";
import { ConsumptionsPage } from "@/components/ConsumptionsPage";
import { ConsumptionsListPage } from "@/components/ConsumptionsListPage";
import { CreditsPage } from "@/components/CreditsPage";
import { AnnouncementsPage } from "@/components/AnnouncementsPage";
import { ChatPage } from "@/components/ChatPage";
import { UsersPage } from "@/components/UsersPage";
import { ProductsPage } from "@/components/ProductsPage";
import { SocietyPage } from "@/components/SocietyPage";
import { SepaExportPage } from "@/components/SepaExportPage";
import { UserProfile } from "@/components/UserProfile";
import NotFound from "@/pages/not-found";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/erreserbak" component={ReservationsPage} />
      <Route path="/kontsumoak" component={ConsumptionsPage} />
      <Route path="/kontsumoak-zerrenda">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <ConsumptionsListPage />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/zorrak" component={CreditsPage} />
      <Route path="/oharrak" component={AnnouncementsPage} />
      <Route path="/txata" component={ChatPage} />
      <Route path="/profila" component={UserProfile} />
      <Route path="/erabiltzaileak">
        {() => (
          <ProtectedRoute requiredAccess="admin">
            <UsersPage />
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
  const { isAuthenticated } = useAuth();

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
