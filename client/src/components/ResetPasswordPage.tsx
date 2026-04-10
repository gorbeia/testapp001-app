import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Lock, Loader2, KeyRound } from "lucide-react";
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

function buildResetSchema(t: (k: "passwordMinLength" | "passwordsDoNotMatch") => string) {
  return z
    .object({
      newPassword: z.string().min(6, t("passwordMinLength")),
      confirmPassword: z.string().min(1),
    })
    .refine(d => d.newPassword === d.confirmPassword, {
      message: t("passwordsDoNotMatch"),
      path: ["confirmPassword"],
    });
}

type ResetFormData = z.infer<ReturnType<typeof buildResetSchema>>;

export function ResetPasswordPage() {
  const { t } = useLanguage();
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isPending: tenantLoading, likelyTenantHost } = useTenantByHost();

  const schema = useMemo(() => buildResetSchema(t), [t]);

  const form = useForm<ResetFormData>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("token");
    setToken(raw && raw.length > 0 ? raw : null);
    setTokenChecked(true);
  }, []);

  const onSubmit = async (data: ResetFormData) => {
    if (!token) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/public/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });

      const errBody = (await res.json().catch(() => ({}))) as { message?: string };

      if (!res.ok) {
        setError(
          typeof errBody.message === "string" ? errBody.message : t("resetPasswordInvalidLink")
        );
        return;
      }

      setDone(true);
    } catch {
      setError(t("serverConnectionFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  if (likelyTenantHost && tenantLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!tokenChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("resetPasswordTitle")}</CardTitle>
            <CardDescription>{t("resetPasswordMissingToken")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/sartu">{t("forgotPasswordBackToLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <KeyRound className="h-8 w-8 text-primary-foreground" aria-hidden />
          </div>
          <CardTitle className="text-2xl font-bold">{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>
            {done ? t("resetPasswordSuccess") : t("resetPasswordDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <Button className="w-full" asChild>
              <Link href="/sartu" data-testid="reset-back-login">
                {t("forgotPasswordBackToLogin")}
              </Link>
            </Button>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("newPasswordLabel")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            className="pl-10"
                            data-testid="reset-input-new-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("confirmPasswordLabel")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            className="pl-10"
                            data-testid="reset-input-confirm-password"
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
                  data-testid="reset-submit"
                >
                  {isLoading ? t("loading") : t("resetPasswordSubmit")}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
