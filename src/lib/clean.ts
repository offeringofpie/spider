export function stripNoise(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

const eventAttrs = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const unsafeUrls =
  /\s+(?:href|src|srcset|action|formaction|xlink:href)\s*=\s*(?:"\s*(?:javascript:|data:text\/html)[^"]*"|'\s*(?:javascript:|data:text\/html)[^']*'|(?:javascript:|data:text\/html)[^\s>]+)/gi;

export function sanitize(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '')
    .replace(/<[a-z][^>]*>/gi, (tag) => {
      return tag.replace(eventAttrs, '').replace(unsafeUrls, '');
    });
}

export function normalizeImages(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const src = tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1];
      const srcset = tag.match(/\bdata-srcset=["']([^"']+)["']/i)?.[1];
      if (!src && !srcset) return tag;
      let out = tag;
      if (src) out = out.replace(/\bsrc=["'][^"']*["']/i, '');
      if (srcset) out = out.replace(/\bsrcset=["'][^"']*["']/i, '');
      const attrs = [src && `src="${src}"`, srcset && `srcset="${srcset}"`]
        .filter(Boolean)
        .join(' ');
      return out.replace(/<img\b/i, `<img ${attrs}`);
    })
    .replace(
      /<div\b[^>]*>\s*(<img\b[^>]*>)\s*(<figcaption\b[^>]*>[\s\S]*?<\/figcaption>)?\s*<\/div>/gi,
      (_full, img, caption = '') => `<figure>${img}${caption}</figure>`,
    );
}

export function lazyLoadImages(html: string): string {
  return html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
}

export function stripAtLinks(html: string): string {
  return html
    .replace(/href=["']at:\/\/[^"']*["']/gi, 'href="#"')
    .replace(/src=["']at:\/\/[^"']*["']/gi, '');
}

export function stripHeadingAttrs(html: string): string {
  return html.replace(/<h([1-6])\b([^>]*)>/gi, (_match, level, attrs) => {
    const cleaned = attrs
      .replace(/\s+class=["'][^"']*["']/gi, '')
      .replace(/\s+id=["'][^"']*["']/gi, '');
    return `<h${level}${cleaned}>`;
  });
}
