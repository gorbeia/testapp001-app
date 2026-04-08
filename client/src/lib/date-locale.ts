import { useLanguage } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { eu, es } from "date-fns/locale";
import type { Locale } from "date-fns";

export type Bcp47LocaleTag = "eu-ES" | "es-ES";

export function bcp47Locale(language: Language): Bcp47LocaleTag {
  return language === "eu" ? "eu-ES" : "es-ES";
}

export function dateFnsLocale(language: Language): Locale {
  return language === "es" ? es : eu;
}

function toDate(input: Date | string): Date {
  return input instanceof Date ? input : new Date(input);
}

function safeFormat(
  input: Date | string,
  language: Language,
  options: Intl.DateTimeFormatOptions
): string {
  const d = toDate(input);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(bcp47Locale(language), options).format(d);
}

/** Numeric date (day/month/year), consistent across tables and lists */
export function formatDateShort(input: Date | string, language: Language): string {
  return safeFormat(input, language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/** Date and time for movement rows, stock, etc. */
export function formatDateTime(input: Date | string, language: Language): string {
  return safeFormat(input, language, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Time only (hour:minute) */
export function formatTimeShort(input: Date | string, language: Language): string {
  return safeFormat(input, language, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Long weekday + calendar date for headers (e.g. welcome banner) */
export function formatDateFullWeekday(input: Date | string, language: Language): string {
  return safeFormat(input, language, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function useFormattedDates() {
  const { language } = useLanguage();
  const tag = bcp47Locale(language);
  const dfns = dateFnsLocale(language);
  return {
    language,
    bcp47Locale: tag,
    dateFnsLocale: dfns,
    formatDateShort: (input: Date | string) => formatDateShort(input, language),
    formatDateTime: (input: Date | string) => formatDateTime(input, language),
    formatTimeShort: (input: Date | string) => formatTimeShort(input, language),
    formatDateFullWeekday: (input: Date | string) => formatDateFullWeekday(input, language),
  };
}
