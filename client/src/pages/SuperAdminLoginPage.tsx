import { useState, useEffect } from "react";
import { Mail, Lock, LogIn, AlertCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authFetch } from "@/lib/api";

// Helper to get backoffice token cookie
const clearBackofficeCookie = () => {
  document.cookie = "backoffice-token=; path=/; max-age=0";
};

const getBackofficeCookie = (): string | null => {
  const match = document.cookie.match(/(^|;)\s*backoffice-token=([^;]+)/);
  return match ? match[2] : null;
};

export function SuperAdminLoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check for existing backoffice token on mount
  useEffect(() => {
    if (getBackofficeCookie()) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await authFetch("/api/backoffice/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.message || "Invalid credentials";
        setError(message);
      } else {
        const data = await response.json().catch(() => ({}));
        if (data.ok) {
          // Token is set automatically by the server cookie; just mark as logged in
          setIsLoggedIn(true);
          setError(null);
          // Redirect to the societies list after successful login
          window.location.replace("/elkarteapp/kudeaketa/societies");
        } else {
          setError("Unexpected response from server");
        }
      }
    } catch (err) {
      setError("Failed to contact backoffice login endpoint");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch("/api/backoffice/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      clearBackofficeCookie();
      setIsLoggedIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      {isLoggedIn ? (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-2xl font-bold">SA</span>
            </div>
            <CardTitle className="text-2xl font-bold">Superadmin</CardTitle>
            <CardDescription>You are logged into the multisociety backoffice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLogout} className="w-full" variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              {t("logout") || "Logout"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-2xl font-bold">SA</span>
            </div>
            <CardTitle className="text-2xl font-bold">Superadmin</CardTitle>
            <CardDescription>
              {t("login")} – multi-society administration (UI only, no backend yet)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="superadmin-email">
                  {t("email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="superadmin-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="superadmin-password">
                  {t("password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="superadmin-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <LogIn className="mr-2 h-4 w-4" />
                {isSubmitting ? t("loading") : t("login")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
