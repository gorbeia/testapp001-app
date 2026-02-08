import type { Request } from "express";
import { translations, type Language, type TranslationKey } from "./translations";

// Export translations for use in other modules
export { translations, type Language, type TranslationKey };

// Default language
const DEFAULT_LANGUAGE: Language = "eu";

// Supported languages
const SUPPORTED_LANGUAGES: Language[] = ["eu", "es", "en"];

/**
 * Get language from request
 * Priority: 1. Accept-Language header, 2. Query parameter, 3. Default
 */
export function getLanguageFromRequest(req: Request): Language {
  // Check query parameter first
  const queryLang = req.query.lang as string;
  if (queryLang && SUPPORTED_LANGUAGES.includes(queryLang as Language)) {
    return queryLang as Language;
  }

  // Check Accept-Language header
  const acceptLanguage = req.headers["accept-language"];
  if (acceptLanguage) {
    // Parse Accept-Language header (e.g., "eu-ES,es;q=0.9,en;q=0.8")
    const languages = acceptLanguage
      .split(",")
      .map(lang => lang.split(";")[0].trim().toLowerCase())
      .map(lang => lang.split("-")[0] as Language); // Take primary language (e.g., 'eu' from 'eu-ES')

    for (const lang of languages) {
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return lang;
      }
    }
  }

  // Fall back to default
  return DEFAULT_LANGUAGE;
}

/**
 * Simple translation function
 */
export function translate(key: TranslationKey, language?: Language): string {
  const lang = language || DEFAULT_LANGUAGE;
  const translation = translations[lang]?.[key] || translations[DEFAULT_LANGUAGE]?.[key];

  if (typeof translation === "string") {
    return translation;
  }

  // Handle nested objects (like emailSubject)
  if (typeof translation === "object" && translation !== null) {
    return JSON.stringify(translation);
  }

  return key; // fallback to key if translation not found
}

/**
 * Get translation with variable substitution
 * Supports variables like {name}, {date}, etc.
 */
export function translateWithParams(
  key: TranslationKey,
  params: Record<string, string | number>,
  language: Language = DEFAULT_LANGUAGE
): string {
  let translation = translate(key, language);

  // Replace variables in the translation
  for (const [param, value] of Object.entries(params)) {
    translation = translation.replace(new RegExp(`\\{${param}\\}`, "g"), String(value));
  }

  return translation;
}

/**
 * Translation helper class for request-scoped translations
 */
export class I18nHelper {
  constructor(private language: Language) {}

  t(key: TranslationKey): string {
    return translate(key, this.language);
  }

  tWithParams(key: TranslationKey, params: Record<string, string | number>): string {
    return translateWithParams(key, params, this.language);
  }

  getLanguage(): Language {
    return this.language;
  }
}

/**
 * Create i18n helper from request
 */
export function createI18nHelper(req: Request): I18nHelper {
  const language = getLanguageFromRequest(req);
  return new I18nHelper(language);
}

/**
 * Middleware to attach i18n helper to request
 */
export function i18nMiddleware(req: Request, res: any, next: any) {
  req.i18n = createI18nHelper(req);
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      i18n?: I18nHelper;
    }
  }
}

/**
 * Get localized date formatter
 */
export function getLocalizedDateFormatter(language: Language): Intl.DateTimeFormatOptions {
  const formats = {
    eu: {
      year: "numeric" as const,
      month: "long" as const,
      day: "numeric" as const,
    },
    es: {
      year: "numeric" as const,
      month: "long" as const,
      day: "numeric" as const,
    },
    en: {
      year: "numeric" as const,
      month: "long" as const,
      day: "numeric" as const,
    },
  };

  return formats[language];
}

/**
 * Format date according to language
 */
export function formatDate(date: Date, language: Language): string {
  const options = getLocalizedDateFormatter(language);
  return date.toLocaleDateString(
    language === "eu" ? "eu-ES" : language === "es" ? "es-ES" : "en-US",
    options
  );
}

/**
 * Get locale for number formatting
 */
export function getNumberLocale(language: Language): string {
  const locales = {
    eu: "eu-ES",
    es: "es-ES",
    en: "en-US",
  };

  return locales[language];
}
