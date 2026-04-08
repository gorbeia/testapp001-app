/** Latin letters incl. common European diacritics (Basque/Spanish/Catalan coverage). */
const LETTER = /[A-Za-z\xC0-\xFF\u0100-\u017F\u0180-\u024F]/;

function lettersOnly(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (LETTER.test(ch)) out += ch;
  }
  return out;
}

function firstLetter(s: string): string {
  for (const ch of s.normalize("NFC")) {
    if (LETTER.test(ch)) return ch;
  }
  return "";
}

/** First letters of up to three whitespace-separated words, else first three letters. */
export function deriveSocietyAcronym(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    const initials = words
      .slice(0, 3)
      .map(w => firstLetter(w))
      .join("");
    return lettersOnly(initials).slice(0, 3).toUpperCase();
  }

  return lettersOnly(words[0] ?? trimmed)
    .slice(0, 3)
    .toUpperCase();
}
