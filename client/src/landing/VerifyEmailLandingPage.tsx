import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingLanguageToggle } from "@/landing/LandingLanguageToggle";
import { useLandingI18n } from "@/landing/i18n";

type VerifyState = "loading" | "ok" | "error" | "missing";

export function VerifyEmailLandingPage() {
  const { locale, setLocale, t } = useLandingI18n();
  const [state, setState] = useState<VerifyState>("loading");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setState("missing");
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/public/verify-email?token=${encodeURIComponent(token)}`);
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          setDetail(typeof data.message === "string" ? data.message : null);
          setState("error");
          return;
        }
        setState("ok");
      } catch {
        setState("error");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background px-4 py-12" lang={locale}>
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
        <ThemeToggle />
      </div>

      <div className="mx-auto max-w-lg pt-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("verifyEmailTitle")}</CardTitle>
            <CardDescription>
              {state === "loading" ? null : state === "ok" ? t("verifyEmailSuccess") : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "loading" ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : null}
            {state === "missing" ? (
              <p className="text-sm text-destructive">{t("verifyEmailMissingToken")}</p>
            ) : null}
            {state === "error" ? (
              <p className="text-sm text-destructive">{detail ?? t("verifyEmailError")}</p>
            ) : null}
            {state === "ok" ? (
              <Button asChild className="w-full">
                <Link href="/sartu" data-testid="verify-email-login">
                  {t("verifyEmailGoLogin")}
                </Link>
              </Button>
            ) : null}
            {state !== "loading" ? (
              <Button asChild variant="ghost" className="w-full">
                <Link href="/">{t("signupBackHome")}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
