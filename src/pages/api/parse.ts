import { drain, runParse } from '../../lib/pipeline';
import type { ParseResult } from '../../lib/types';

export const prerender = false;

const budget = 9000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const cacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  'Netlify-CDN-Cache-Control':
    'public, durable, s-maxage=86400, stale-while-revalidate=604800',
};

const partialCacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'Netlify-CDN-Cache-Control':
    'public, durable, s-maxage=3600, stale-while-revalidate=86400',
};

function target(urlString: string | null): URL | Response {
  if (!urlString) {
    return new Response(
      JSON.stringify({
        error: 'Invalid/No URL provided',
        usage: 'Add ?q=URL_TO_PARSE',
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid URL format', provided: urlString }),
      { status: 400, headers: corsHeaders },
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return new Response(
      JSON.stringify({
        error: 'Only http and https URLs are supported',
        provided: urlString,
      }),
      { status: 400, headers: corsHeaders },
    );
  }

  return url;
}

function serialise(result: ParseResult): Response {
  if (result.kind === 'article') {
    return new Response(
      JSON.stringify({
        ...result.post,
        meta: result.meta,
        attempts: result.attempts,
      }),
      {
        status: 200,
        headers: result.confident ? cacheHeaders : partialCacheHeaders,
      },
    );
  }

  return new Response(
    JSON.stringify({
      error: result.error,
      url: result.url,
      suggestion: result.suggestion,
      attempts: result.attempts,
      archive_links: [
        {
          label: 'Wayback Machine snapshots',
          url: `https://web.archive.org/web/*/${result.url}`,
        },
        {
          label: 'Archive this page now',
          url: `https://web.archive.org/save/${result.url}`,
        },
      ],
    }),
    { status: 500, headers: corsHeaders },
  );
}

export async function GET({ request }: { request: Request }) {
  const { searchParams } = new URL(request.url);
  const url = target(searchParams.get('q'));
  if (url instanceof Response) {
    return url;
  }

  const strategy = searchParams.get('strategy') ?? 'auto';
  const freshness = searchParams.get('fresh') === '1' ? 'fresh' : 'cached';
  return serialise(
    await drain(runParse(url, { strategy, budget, freshness })),
  );
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}
