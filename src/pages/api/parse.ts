import { drain, runParse } from '../../lib/pipeline';
import type { ParseOptions } from '../../lib/pipeline';
import type { ParseEvent, ParseResult } from '../../lib/types';

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

const streamHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/x-ndjson',
  'Cache-Control': 'no-store',
};

function terminal(result: ParseResult): ParseEvent[] {
  if (result.kind === 'failure') {
    return [
      {
        type: 'failed',
        error: result.error,
        suggestion: result.suggestion,
        url: result.url,
        attempts: result.attempts,
      },
    ];
  }
  return [
    { type: 'article', stage: 'final', post: result.post, meta: result.meta },
    { type: 'done', attempts: result.attempts },
  ];
}

function stream(url: URL, options: ParseOptions): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const write = (event: ParseEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const events = runParse(url, options);
        let next = await events.next();
        while (!next.done) {
          write(next.value);
          next = await events.next();
        }
        for (const event of terminal(next.value)) {
          write(event);
        }
      } catch (error) {
        write({
          type: 'failed',
          error: (error as Error).message,
          suggestion: 'The parser crashed. Try again or use an archive link.',
          url: url.href,
          attempts: [],
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { status: 200, headers: streamHeaders });
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
  const options: ParseOptions = { strategy, budget, freshness };

  if (searchParams.get('stream') === '1') {
    return stream(url, options);
  }
  return serialise(await drain(runParse(url, options)));
}

export async function OPTIONS() {
  return new Response('OK', { status: 200, headers: corsHeaders });
}
