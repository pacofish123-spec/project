import { supportedLanguages, type SupportedLanguage } from "./marketplace-config";

// Parses a raw `Accept-Language` header ("es-DO,es;q=0.9,en;q=0.8") into
// its language tags ordered by preference, ignoring quality values —
// the header already lists them most-preferred first.
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
    .filter(Boolean);
}

// Server-side counterpart to the client fallback in i18n.tsx's
// LanguageProvider — used by the root layout so the very first HTML
// (what a crawler sees, and what a visitor's browser paints before any
// hydration) already matches their language instead of always
// shipping English and switching after mount. "en" when nothing in
// the header matches a supported language, same default the client
// side has always used.
export function detectLanguageFromAcceptHeader(header: string | null): SupportedLanguage {
  if (!header) return "en";
  const candidates = parseAcceptLanguage(header);
  const match = candidates.find((lang) => (supportedLanguages as readonly string[]).includes(lang));
  return (match as SupportedLanguage) ?? "en";
}
