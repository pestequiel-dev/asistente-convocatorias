/** Minimal es/en probe over crawled text. */
export function detectLanguage(text: string): "es" | "en" {
  const en = (text.match(/\b(the|and|with|for|you|your|we|our|is|are|of|to|in|what|how)\b/gi) ?? []).length;
  const es = (text.match(/\b(el|la|los|las|de|que|y|con|para|por|tu|su|es|son|en|del|una|como)\b/gi) ?? []).length;
  return en > es * 1.15 && en > 8 ? "en" : "es";
}
