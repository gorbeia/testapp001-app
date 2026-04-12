import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Mail, Lock, LogIn, AlertCircle, Building, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useTenantByHost } from "@/hooks/useTenantByHost";
import { absoluteApexOrigin, getClientTenantApexDomain } from "@/lib/tenant-client";

const loginSchema = z.object({
  societyId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { login } = useAuth();
  const { data: tenantData, isPending: tenantLoading, likelyTenantHost } = useTenantByHost();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      societyId: "GT001",
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (tenantData?.mode === "tenant") {
      form.setValue("societyId", tenantData.alphabeticId);
    }
  }, [tenantData, form]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    setEmailNotVerified(false);
    setResendState("idle");
    try {
      await login(data.email, data.password, data.societyId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";

      if (errorMessage === "Server connection failed") {
        setError(
          t("serverConnectionFailed") || "Server connection failed. Please try again later."
        );
      } else if (errorMessage === "Server error occurred") {
        setError(t("serverErrorOccurred") || "Server error occurred. Please try again later.");
      } else if (errorMessage === "EMAIL_NOT_VERIFIED") {
        setError(t("emailNotVerified"));
        setEmailNotVerified(true);
      } else {
        setError(t("invalidCredentials"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const { email, societyId } = form.getValues();
    setResendState("sending");
    try {
      const res = await fetch("/api/public/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, societyId }),
      });
      setResendState(res.ok ? "sent" : "error");
    } catch {
      setResendState("error");
    }
  };

  const isTenant = tenantData?.mode === "tenant";
  const isTenantMissing = tenantData?.mode === "tenant_not_found";
  const mainSiteOrigin = useMemo(() => {
    if (tenantData?.mode !== "tenant_not_found") return null;
    const apex = tenantData.apexDomain ?? getClientTenantApexDomain();
    if (!apex) return null;
    return absoluteApexOrigin(apex);
  }, [tenantData]);
  const showPublicBackLink = !isTenant && !isTenantMissing;
  const showDemoBlock = !isTenant && !isTenantMissing;
  const logoSrc =
    isTenant && tenantData.logoUrl
      ? `/api/images/${tenantData.societyId}/${tenantData.logoUrl}`
      : null;

  if (likelyTenantHost && tenantLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      {showPublicBackLink && (
        <Link
          href="/"
          className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          data-testid="link-landing-back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("loginBackToPublicHome")}
        </Link>
      )}

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isTenantMissing ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
              </div>
              <CardTitle className="text-xl font-bold">{t("loginTenantNotFound")}</CardTitle>
              {mainSiteOrigin ? (
                <CardDescription className="pt-2">
                  <a
                    href={`${mainSiteOrigin}/`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    data-testid="link-tenant-not-found-main-site"
                  >
                    {t("loginTenantNotFoundGoToMain")}
                  </a>
                </CardDescription>
              ) : null}
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={isTenant ? tenantData.name : ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-primary-foreground">
                    {isTenant ? (tenantData.acronym || "?").slice(0, 3).toUpperCase() : "Et"}
                  </span>
                )}
              </div>
              <CardTitle className="text-2xl font-bold">
                {isTenant ? tenantData.name : t("appName")}
              </CardTitle>
              <CardDescription>
                {isTenant ? tenantData.shortDescription?.trim() || "" : t("loginDefaultTagline")}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {!isTenantMissing && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                    {emailNotVerified && resendState !== "sent" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={resendState === "sending"}
                        onClick={() => void handleResendVerification()}
                        data-testid="button-resend-verification"
                      >
                        {resendState === "sending" ? (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        ) : (
                          <Mail className="mr-2 h-3 w-3" />
                        )}
                        {t("resendVerificationEmail")}
                      </Button>
                    )}
                    {resendState === "sent" && (
                      <p className="text-xs text-muted-foreground">{t("resendVerificationEmailSent")}</p>
                    )}
                    {resendState === "error" && (
                      <p className="text-xs">{t("resendVerificationEmailError")}</p>
                    )}
                  </div>
                )}

                {!isTenant && (
                  <FormField
                    control={form.control}
                    name="societyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("societyId")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="GT001"
                              className="pl-10"
                              data-testid="input-society-id"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("email")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="zure@emaila.eus"
                            className="pl-10"
                            data-testid="input-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                            data-testid="input-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isTenantMissing && (
                  <div className="text-right text-sm">
                    <Link
                      href="/pasahitza-ahaztu"
                      className="text-primary underline-offset-4 hover:underline"
                      data-testid="link-forgot-password"
                    >
                      {t("forgotPasswordLink")}
                    </Link>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  {isLoading ? t("loading") : t("login")}
                </Button>
              </form>
            </Form>
          )}

          {showDemoBlock && (
            <div className="mt-6 p-3 bg-muted rounded-md text-xs text-muted-foreground">
              <p className="font-medium mb-1">Demo kontuak / Cuentas demo:</p>
              <ul className="space-y-0.5">
                <li>admin@txokoa.eus (Administratzailea)</li>
                <li>diruzaina@txokoa.eus (Diruzaina)</li>
                <li>sotolaria@txokoa.eus (Sotolaria)</li>
                <li>bazkidea@txokoa.eus (Bazkidea)</li>
                <li>laguna@txokoa.eus (Laguna)</li>
              </ul>
              <p className="mt-1 italic">Pasahitza: edozein / cualquiera</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
