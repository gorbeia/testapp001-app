import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Mail, Building, ArrowLeft, Loader2, KeyRound } from "lucide-react";
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
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";
import { useTenantByHost } from "@/hooks/useTenantByHost";

const forgotPasswordFormSchema = z.object({
  societyId: z.string().optional(),
  email: z.string().email(),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordFormSchema>;

export function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { data: tenantData, isPending: tenantLoading, likelyTenantHost } = useTenantByHost();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      societyId: "",
      email: "",
    },
  });

  useEffect(() => {
    if (tenantData?.mode === "tenant") {
      form.setValue("societyId", tenantData.alphabeticId);
    }
  }, [tenantData, form]);

  const isTenant = tenantData?.mode === "tenant";

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError(null);
    if (!isTenant && (!data.societyId || !data.societyId.trim())) {
      form.setError("societyId", { type: "manual", message: t("forgotPasswordSocietyRequired") });
      return;
    }

    setIsLoading(true);
    try {
      const body: { email: string; societyId?: string } = {
        email: data.email.trim().toLowerCase(),
      };
      if (!isTenant) {
        body.societyId = data.societyId!.trim();
      } else if (data.societyId?.trim()) {
        body.societyId = data.societyId.trim();
      }

      const res = await fetch("/api/public/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        setError(t("forgotPasswordTooManyRequests"));
        return;
      }

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setError(typeof err.message === "string" ? err.message : t("serverErrorOccurred"));
        return;
      }

      setDone(true);
    } catch {
      setError(t("serverConnectionFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const showPublicBackLink = useMemo(
    () => tenantData?.mode !== "tenant" && tenantData?.mode !== "tenant_not_found",
    [tenantData?.mode]
  );

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
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("loginBackToPublicHome")}
        </Link>
      )}

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <KeyRound className="h-8 w-8 text-primary-foreground" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-bold">{t("forgotPasswordTitle")}</CardTitle>
          <CardDescription>{t("forgotPasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <p className="text-sm text-muted-foreground">{t("forgotPasswordEmailSent")}</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
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
                            <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="GT001"
                              className="pl-10"
                              data-testid="forgot-input-society-id"
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
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            className="pl-10"
                            data-testid="forgot-input-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="forgot-submit"
                >
                  {isLoading ? t("loading") : t("forgotPasswordSubmit")}
                </Button>
              </form>
            </Form>
          )}

          <Button variant="outline" className="w-full" asChild>
            <Link href="/sartu" data-testid="forgot-back-login">
              {t("forgotPasswordBackToLogin")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
