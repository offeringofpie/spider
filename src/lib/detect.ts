const challengeMarkers =
  /cf-browser-verification|cf-challenge-running|_cf_chl_opt|cf_chl_opt|id=["']challenge-form["']|awsWafCookieDomainList|AwsWafIntegration|id=["']challenge-container["']/i;

const challengeTitles =
  /^(just a moment|attention required|security verification|ddos protection|access denied|access to this page has been denied|verifying you are human|checking your browser)/i;

const paywallTerms =
  /paywall|subscribe|subscription|subscriber|premium|metered|register to (?:read|continue)|members? only|continue reading|s'abonner|abonnez|abonnement|abonnieren|abonnenten|abonneren|assinar|assine|suscr[ií]bete|iniciar sesi[oó]n|contenido premium/i;

const paywallMaxWords = 200;
const paywallMinHtmlLength = 5_000;

const mediumApp = /<meta[^>]+al:ios:app_name[^>]+content=["']Medium["']/i;
const mediumWordCount = /"wordCount":(\d+)/;
const teaserRatio = 1.5;

export function mediumPage(html: string): boolean {
  return mediumApp.test(html);
}

function mediumTeaser(html: string, words: number): boolean {
  const declared = html.match(mediumWordCount)?.[1];
  if (!declared || !mediumPage(html)) {
    return false;
  }

  return Number(declared) >= words * teaserRatio;
}

export function botChallenge(html: string, title: string | null): boolean {
  if (challengeMarkers.test(html)) {
    return true;
  }
  if (title && challengeTitles.test(title.trim())) {
    return true;
  }

  return false;
}

export function paywall(html: string, words: number): boolean {
  if (mediumTeaser(html, words)) {
    return true;
  }

  return (
    words < paywallMaxWords &&
    html.length > paywallMinHtmlLength &&
    paywallTerms.test(html)
  );
}
