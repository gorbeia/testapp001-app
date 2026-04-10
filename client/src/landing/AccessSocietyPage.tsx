import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useLandingI18n, LANDING_LOCALE_STORAGE_KEY, type LandingLocale } from "@/landing/i18n";
import { getClientTenantApexDomain } from "@/lib/tenant-client";

const formSchema = z.object({
  email: z.string().trim().email(),
});

type FormValues = z.infer<typeof formSchema>;

export function AccessSocietyPage() {
  const { locale, setLocale, t } = useLandingI18n();
  const apex = getClientTenantApexDomain();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("lang");
    if (q === "es" || q === "eu") {
      setLocale(q as LandingLocale);
      window.localStorage.setItem(LANDING_LOCALE_STORAGE_KEY, q);
    }
  }, [setLocale]);

  const explanation =
    apex != null
      ? locale === "es"
        ? `El inicio de sesión solo está disponible en la dirección web de tu sociedad, con el formato https://subdominio.${apex} — no en el sitio principal. Si no recuerdas la dirección, introduce abajo el mismo correo con el que inicias sesión y te enviaremos los enlaces de las sociedades donde tienes cuenta.`
        : `Saioa elkarteko helbidean bakarrik has daiteke, https://azpidomeinua.${apex} formatuan — ez nagusian. Ez baduzu gogoratzen helbidea, idatzi behean saio-hasierako posta bera eta bidaliko dizkizugu zure elkarteen estekak.`
      : t("accessSocietyIntro");

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      const res = await fetch("/api/public/society-access-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email.trim().toLowerCase() }),
      });
      if (res.status === 404) {
        setError(t("accessSocietyErrorGeneric"));
        return;
      }
      if (res.status === 429) {
        setError(t("accessSocietyTooManyRequests"));
        return;
      }
      if (!res.ok) {
        setError(t("accessSocietyErrorGeneric"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("accessSocietyErrorGeneric"));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" lang={locale}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" asChild className="gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t("accessSocietyBackHome")}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" aria-hidden />
            </div>
            <CardTitle>{t("accessSocietyTitle")}</CardTitle>
            <CardDescription className="text-base leading-relaxed">{explanation}</CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("accessSocietySuccess")}
              </p>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("accessSocietyEmailLabel")}</FormLabel>
                        <FormControl>
                          <Input type="email" autoComplete="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        {t("accessSocietySubmitting")}
                      </>
                    ) : (
                      t("accessSocietySubmit")
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
