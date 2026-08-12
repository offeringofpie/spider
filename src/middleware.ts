import { defineMiddleware } from 'astro:middleware';

const securityHeaders = {
  'X-Powered-By': 'Pie',
  'X-Clacks-Overhead': 'GNU Terry Pratchett',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Content-Security-Policy': "frame-ancestors 'self' https://news.jlopes.eu",
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

const discoveryLinks = [
  '</llms.txt>; rel="alternate"; type="text/plain"; title="llms.txt"',
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
].join(', ');

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  response.headers.set('Link', discoveryLinks);

  return response;
});
