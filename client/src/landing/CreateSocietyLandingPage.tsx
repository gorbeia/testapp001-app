import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingLanguageToggle } from "@/landing/LandingLanguageToggle";
import type { TenantByHostQueryData } from "@/hooks/useTenantByHost";
import { useTenantByHost } from "@/hooks/useTenantByHost";
import {
  landingByLocale,
  useLandingI18n,
  type LandingKey,
  type LandingLocale,
} from "@/landing/i18n";
import { getClientTenantApexDomain } from "@/lib/tenant-client";
import { cn } from "@/lib/utils";
import {
  RESERVED_SOCIETY_SUBDOMAIN_LABELS,
  SOCIETY_SUBDOMAIN_LABEL_REGEX,
} from "@shared/tenant-host";

const SIGNUP_API_MESSAGE_KEYS: Record<string, LandingKey> = {
  "Too many requests": "signupErrorTooManyRequests",
  "Invalid signup payload": "signupErrorInvalidPayload",
  "A valid subdomain is required for your organization URL": "signupErrorSubdomainRequired",
  "Could not complete signup": "signupErrorCouldNotComplete",
};

function mapSignupSubmitError(message: string | undefined, t: (key: LandingKey) => string): string {
  if (!message) return t("signupErrorGeneric");
  const key = SIGNUP_API_MESSAGE_KEYS[message];
  return key ? t(key) : message;
}

function resolveApexForSignup(
  tenantData: TenantByHostQueryData | undefined,
  isPending: boolean,
  viteApex: string | null
): string | null {
  if (tenantData?.mode === "tenant_not_found" && tenantData.apexDomain) {
    return tenantData.apexDomain;
  }
  if (tenantData?.mode === "tenant") {
    return null;
  }
  if (tenantData?.mode === "apex") {
    if (tenantData.multitenancyEnabled === true && tenantData.apexDomain) {
      return tenantData.apexDomain;
    }
    return null;
  }
  if (isPending) {
    return viteApex;
  }
  return viteApex;
}

function buildSignupSchema(requireSubdomain: boolean, locale: LandingLocale) {
  const copy = landingByLocale[locale];
  return z
    .object({
      societyName: z
        .string()
        .trim()
        .min(1, { message: copy.signupValidationRequired })
        .max(200, { message: copy.signupValidationText200Max }),
      shortDescription: z
        .string()
        .trim()
        .max(250, { message: copy.signupValidationShortDescriptionMax })
        .optional(),
      acronym: z.string().trim().max(3, { message: copy.signupValidationAcronymMax }).optional(),
      societyContactEmail: z.union([
        z.literal(""),
        z.string().trim().email({ message: copy.signupValidationEmailInvalid }),
      ]),
      societyPhone: z
        .string()
        .trim()
        .max(80, { message: copy.signupValidationPhoneMax })
        .optional(),
      societyAddress: z
        .string()
        .trim()
        .max(500, { message: copy.signupValidationAddressMax })
        .optional(),
      subdomain: z.string().optional(),
      adminName: z
        .string()
        .trim()
        .min(1, { message: copy.signupValidationRequired })
        .max(200, { message: copy.signupValidationText200Max }),
      adminEmail: z.string().trim().email({ message: copy.signupValidationEmailInvalid }),
      adminPassword: z
        .string()
        .min(8, { message: copy.signupValidationPasswordTooShort })
        .max(128, { message: copy.signupValidationPasswordTooLong }),
      adminPasswordConfirm: z.string(),
      marketingOptIn: z.boolean(),
      acceptTerms: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (requireSubdomain) {
        const s = data.subdomain?.trim().toLowerCase() ?? "";
        if (!s) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: copy.signupSubdomainRequired,
            path: ["subdomain"],
          });
        } else if (
          !SOCIETY_SUBDOMAIN_LABEL_REGEX.test(s) ||
          RESERVED_SOCIETY_SUBDOMAIN_LABELS.has(s)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: copy.signupSubdomainInvalid,
            path: ["subdomain"],
          });
        }
      }
      if (data.adminPassword !== data.adminPasswordConfirm) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.signupPasswordMismatch,
          path: ["adminPasswordConfirm"],
        });
      }
      if (data.acceptTerms !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.signupTermsRequired,
          path: ["acceptTerms"],
        });
      }
    });
}

type SignupFormValues = z.infer<ReturnType<typeof buildSignupSchema>>;

export function CreateSocietyLandingPage() {
  const { locale, setLocale, t } = useLandingI18n();
  const { data: tenantHostData, isPending: tenantHostPending } = useTenantByHost();
  const viteApex = getClientTenantApexDomain();
  const apexForSignup = resolveApexForSignup(tenantHostData, tenantHostPending, viteApex);
  const requireSubdomain = Boolean(apexForSignup);
  const signupSchema = useMemo(
    () => buildSignupSchema(requireSubdomain, locale),
    [requireSubdomain, locale]
  );
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "ok" | "bad">(
    "idle"
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successAlphabeticId, setSuccessAlphabeticId] = useState<string | null>(null);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      societyName: "",
      shortDescription: "",
      acronym: "",
      societyContactEmail: "",
      societyPhone: "",
      societyAddress: "",
      subdomain: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      adminPasswordConfirm: "",
      marketingOptIn: false,
      acceptTerms: false,
    },
  });

  const subdomainWatch = useWatch({ control: form.control, name: "subdomain" });

  useEffect(() => {
    if (!apexForSignup) {
      setSubdomainStatus("idle");
      return;
    }
    const raw = subdomainWatch?.trim() ?? "";
    if (!raw) {
      setSubdomainStatus("idle");
      return;
    }

    const handle = window.setTimeout(() => {
      setSubdomainStatus("checking");
      void (async () => {
        try {
          const res = await fetch(`/api/public/check-subdomain?value=${encodeURIComponent(raw)}`);
          const data = (await res.json()) as { available?: boolean };
          setSubdomainStatus(data.available ? "ok" : "bad");
        } catch {
          setSubdomainStatus("bad");
        }
      })();
    }, 400);

    return () => window.clearTimeout(handle);
  }, [subdomainWatch, apexForSignup]);

  const onSubmit = async (values: SignupFormValues) => {
    setSubmitError(null);
    const body = {
      societyName: values.societyName.trim(),
      shortDescription: values.shortDescription?.trim() || undefined,
      acronym: values.acronym?.trim() || undefined,
      societyContactEmail: values.societyContactEmail?.trim() || undefined,
      societyPhone: values.societyPhone?.trim() || undefined,
      societyAddress: values.societyAddress?.trim() || undefined,
      subdomain: apexForSignup ? values.subdomain?.trim() : undefined,
      adminName: values.adminName.trim(),
      adminEmail: values.adminEmail.trim().toLowerCase(),
      adminPassword: values.adminPassword,
      marketingOptIn: values.marketingOptIn,
      acceptTerms: true as const,
      communicationLanguage: locale,
    };

    try {
      const res = await fetch("/api/public/society-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        alphabeticId?: string;
        subdomain?: string | null;
      };

      if (!res.ok) {
        setSubmitError(mapSignupSubmitError(data.message, t));
        return;
      }

      const alphabeticId = data.alphabeticId ?? "";
      const sub = data.subdomain ?? null;

      if (apexForSignup && sub) {
        const secure = import.meta.env.PROD;
        const url = `${secure ? "https" : "http"}://${sub}.${apexForSignup}/sartu`;
        window.location.href = url;
        return;
      }

      setSuccessAlphabeticId(alphabeticId);
    } catch {
      setSubmitError(t("signupErrorGeneric"));
    }
  };

  if (successAlphabeticId) {
    return (
      <div className="min-h-screen bg-background px-4 py-12" lang={locale}>
        <div className="mx-auto max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>{t("signupTitle")}</CardTitle>
              <CardDescription>{t("signupSuccessCheckEmail")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("signupSuccessAlphabeticId")}
                </span>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
                  {successAlphabeticId}
                </code>
              </p>
              <Button asChild className="w-full">
                <Link href="/sartu">{t("signupGoLogin")}</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/">{t("signupBackHome")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" lang={locale}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("signupBackHome")}
          </Link>
          <div className="flex items-center gap-2">
            <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">{t("signupTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("signupSubtitle")}</p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-10">
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">{t("signupSectionSociety")}</h2>
              <FormField
                control={form.control}
                name="societyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldSocietyName")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="organization"
                        data-testid="signup-society-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shortDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldShortDescription")}</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={250} data-testid="signup-short-desc" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acronym"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldAcronym")}</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={3} data-testid="signup-acronym" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="societyContactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldSocietyEmail")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="signup-society-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="societyPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldSocietyPhone")}</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" data-testid="signup-society-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="societyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldSocietyAddress")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} data-testid="signup-society-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {apexForSignup ? (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">{t("signupSectionWeb")}</h2>
                <FormField
                  control={form.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("signupFieldSubdomain")}</FormLabel>
                      <FormControl>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <Input {...field} autoComplete="off" data-testid="signup-subdomain" />
                          <span className="text-sm text-muted-foreground">.{apexForSignup}</span>
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t("signupSubdomainHint")}{" "}
                        <span className="font-medium text-foreground">
                          {`${window.location.protocol}//${field.value?.trim() ? `${field.value.trim()}.${apexForSignup}` : `…${apexForSignup}`}/sartu`}
                        </span>
                      </p>
                      <div
                        className={cn(
                          "text-xs",
                          subdomainStatus === "ok" && "text-green-600 dark:text-green-500",
                          subdomainStatus === "bad" && "text-destructive",
                          subdomainStatus === "checking" && "text-muted-foreground"
                        )}
                        data-testid="signup-subdomain-status"
                      >
                        {subdomainStatus === "checking" && t("signupSubdomainChecking")}
                        {subdomainStatus === "ok" && t("signupSubdomainAvailable")}
                        {subdomainStatus === "bad" && t("signupSubdomainTakenOrInvalid")}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
            ) : null}

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">{t("signupSectionAdmin")}</h2>
              <FormField
                control={form.control}
                name="adminName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldAdminName")}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="name" data-testid="signup-admin-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldAdminEmail")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        autoComplete="email"
                        data-testid="signup-admin-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldAdminPassword")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
                        data-testid="signup-admin-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminPasswordConfirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("signupFieldAdminPasswordConfirm")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        autoComplete="new-password"
                        data-testid="signup-admin-password2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marketingOptIn"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="signup-marketing"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">{t("signupMarketingOptIn")}</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="signup-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-normal">
                        {t("signupAcceptTerms")}{" "}
                        <a href="#" className="text-primary underline">
                          {t("signupTermsLink")}
                        </a>
                        {" · "}
                        <a href="#" className="text-primary underline">
                          {t("signupPrivacyLink")}
                        </a>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
            </section>

            {submitError ? (
              <p className="text-sm text-destructive" data-testid="signup-error">
                {submitError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={form.formState.isSubmitting}
              data-testid="signup-submit"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {t("signupSubmitting")}
                </>
              ) : (
                t("signupSubmit")
              )}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
