import { Link } from "wouter";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  Coins,
  Globe2,
  MessagesSquare,
  Package2,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LandingLanguageToggle } from "@/landing/LandingLanguageToggle";
import { useLandingI18n, type LandingKey } from "@/landing/i18n";
import { cn } from "@/lib/utils";

const FEATURE_ICONS = [
  Users,
  CalendarClock,
  ClipboardList,
  Coins,
  Package2,
  MessagesSquare,
  Receipt,
  Globe2,
  ShieldCheck,
] as const;

type CardTitleKey = `card${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}Title`;
type CardBodyKey = `card${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}Body`;

const TABLE_ROW_KEYS = [
  ["tableR1Area", "tableR1Funcs"],
  ["tableR2Area", "tableR2Funcs"],
  ["tableR3Area", "tableR3Funcs"],
  ["tableR4Area", "tableR4Funcs"],
  ["tableR5Area", "tableR5Funcs"],
  ["tableR6Area", "tableR6Funcs"],
  ["tableR7Area", "tableR7Funcs"],
  ["tableR8Area", "tableR8Funcs"],
  ["tableR9Area", "tableR9Funcs"],
  ["tableR10Area", "tableR10Funcs"],
] as const satisfies ReadonlyArray<readonly [LandingKey, LandingKey]>;

export function LandingPage() {
  const { locale, setLocale, t } = useLandingI18n();

  return (
    <div className="min-h-screen bg-background text-foreground" lang={locale}>
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              GT
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{t("brandShort")}</p>
              <p className="truncate text-xs text-muted-foreground">{t("productName")}</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LandingLanguageToggle locale={locale} onLocaleChange={setLocale} />
            <ThemeToggle />
            <Button asChild data-testid="landing-login-header">
              <Link href="/sartu">{t("ctaLogin")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b bg-gradient-to-b from-muted/40 to-background px-4 py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("heroTitle")}</h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">{t("heroSubtitle")}</p>
            <p className="mt-6 leading-relaxed text-muted-foreground">{t("heroLead")}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" data-testid="landing-login-hero">
                <Link href="/sartu">{t("ctaLogin")}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 md:py-16">
          <h2 className="text-center text-2xl font-semibold">{t("featuresHeading")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            {t("featuresSub")}
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_ICONS.map((Icon, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
              const titleKey = `card${n}Title` as CardTitleKey;
              const bodyKey = `card${n}Body` as CardBodyKey;
              return (
                <Card key={titleKey} className="border-muted/80 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <CardTitle className="text-base font-semibold leading-snug">
                      {t(titleKey)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                      {t(bodyKey)}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="border-t bg-muted/20 px-4 py-14 md:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold">{t("summaryTitle")}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
              {t("summarySub")}
            </p>
            <div className="mt-8 overflow-x-auto rounded-lg border bg-card shadow-sm">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 font-medium">{t("tableColArea")}</th>
                    <th className="px-4 py-3 font-medium">{t("tableColFunctions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE_ROW_KEYS.map(([areaKey, funcKey], idx) => (
                    <tr
                      key={areaKey}
                      className={cn("border-b last:border-0", idx % 2 === 1 && "bg-muted/15")}
                    >
                      <td className="whitespace-nowrap px-4 py-3 align-top font-medium">
                        {t(areaKey)}
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{t(funcKey)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Building2 className="mx-auto h-10 w-10 text-primary opacity-90" aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold">{t("closingTitle")}</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{t("closingBody")}</p>
          <Button asChild className="mt-8" size="lg" data-testid="landing-login-footer">
            <Link href="/sartu">{t("ctaLogin")}</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {t("brandShort")} — {t("productName")}
      </footer>
    </div>
  );
}
