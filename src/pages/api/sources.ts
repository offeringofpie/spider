import { lookupSources } from '../../lib/sources';

export const prerender = false;

const budget = 4500;
const ok = 200;
const badRequest = 400;

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

const cacheHeaders = {
  ...jsonHeaders,
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=21600',
  'Netlify-CDN-Cache-Control':
    'public, durable, s-maxage=3600, stale-while-revalidate=21600',
};

function articleUrl(value: string | null): URL | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export async function GET({
  request,
}: {
  request: Request;
}): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const url = articleUrl(searchParams.get('url'));
  if (!url) {
    return new Response(
      JSON.stringify({
        error: 'Invalid/No URL provided',
        usage: 'Add ?url=ARTICLE_URL (http or https)',
      }),
      { status: badRequest, headers: jsonHeaders },
    );
  }

  const result = await lookupSources(
    {
      url,
      title: searchParams.get('title'),
    },
    budget,
  );
  return new Response(JSON.stringify(result), {
    status: ok,
    headers: cacheHeaders,
  });
}
