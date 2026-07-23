export function botChallenge(html: string, title: string | null): boolean {
  if (
    /cf-browser-verification|cf-challenge-running|id="challenge-form"/i.test(
      html,
    )
  )
    return true;
  if (
    title &&
    /^(just a moment\.?|security verification|attention required|ddos protection)$/i.test(
      title.trim(),
    )
  )
    return true;
  return false;
}

export function paywall(
  html: string,
  parsed: { word_count?: number | null; content?: string | null },
): boolean {
  const wordCount = parsed.word_count ?? 0;
  const contentWordCount = parsed.content
    ? parsed.content
        .replace(/<[^>]+>/g, '')
        .split(/\s+/)
        .filter(Boolean).length
    : 0;
  const effectiveCount = Math.max(wordCount, contentWordCount);
  const paywallTerms = /paywall|subscribe|premium|subscriber|sign in/i;
  return (
    effectiveCount < 150 && html.length > 20_000 && paywallTerms.test(html)
  );
}
