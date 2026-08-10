const challengeMarkers =
  /cf-browser-verification|cf-challenge-running|_cf_chl_opt|cf_chl_opt|id=["']challenge-form["']/i;

const challengeTitles =
  /^(just a moment|attention required|security verification|ddos protection|access denied|access to this page has been denied|verifying you are human|checking your browser)/i;

const paywallTerms =
  /paywall|subscribe|subscription|subscriber|premium|metered|register to (?:read|continue)|members? only|continue reading|s'abonner|abonnez|abonnement|abonnieren|abonnenten|abonneren|assinar|assine|suscr[ií]bete|iniciar sesi[oó]n|contenido premium/i;

export function botChallenge(html: string, title: string | null): boolean {
  if (challengeMarkers.test(html)) return true;
  if (title && challengeTitles.test(title.trim())) return true;
  return false;
}

export function paywall(html: string, words: number): boolean {
  return words < 200 && html.length > 5_000 && paywallTerms.test(html);
}
