import { Button } from "@/components/ui/button";
import type { LandingLocale } from "@/landing/i18n";

interface LandingLanguageToggleProps {
  locale: LandingLocale;
  onLocaleChange: (locale: LandingLocale) => void;
}

/** EU/ES for the public landing only — does not touch app `language` / `useLanguage()`. */
export function LandingLanguageToggle({ locale, onLocaleChange }: LandingLanguageToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={locale === "eu" ? "default" : "ghost"}
        size="sm"
        onClick={() => onLocaleChange("eu")}
        data-testid="landing-button-lang-eu"
        className="px-2 text-xs"
        type="button"
      >
        EU
      </Button>
      <Button
        variant={locale === "es" ? "default" : "ghost"}
        size="sm"
        onClick={() => onLocaleChange("es")}
        data-testid="landing-button-lang-es"
        className="px-2 text-xs"
        type="button"
      >
        ES
      </Button>
    </div>
  );
}
