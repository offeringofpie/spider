const mediaBase = 'https://spider-media.invalid/';

interface IframeMeta {
  kind: 'iframe';
  src: string;
  provider: string;
}
interface AudioMeta {
  kind: 'audio';
  src?: string;
  sources?: Array<{ src: string; type?: string }>;
}
interface VideoMeta {
  kind: 'video';
  src?: string;
  sources?: Array<{ src: string; type?: string }>;
  poster?: string;
}

type MediaMeta = IframeMeta | AudioMeta | VideoMeta;

function encodeMeta(meta: MediaMeta): string {
  return `${mediaBase}${encodeURIComponent(JSON.stringify(meta))}`;
}

const iframeAttrs: Record<string, { sandbox: string; allow: string }> = {
  youtube: {
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    allow: 'autoplay; fullscreen; encrypted-media',
  },
  vimeo: {
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
    allow: 'autoplay; fullscreen; picture-in-picture',
  },
  spotify: {
    sandbox: 'allow-scripts allow-same-origin allow-presentation',
    allow:
      'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
  },
  soundcloud: {
    sandbox: 'allow-scripts allow-same-origin allow-popups',
    allow: 'autoplay',
  },
  codepen: { sandbox: 'allow-scripts allow-same-origin', allow: '' },
};

const iframeFixedHeight: Record<string, string> = {
  spotify: '152',
  soundcloud: '166',
};

const embedProviders = [
  { pattern: /youtube\.com\/embed\//i, name: 'youtube' },
  { pattern: /player\.vimeo\.com\/video\//i, name: 'vimeo' },
  { pattern: /codepen\.io\/[^/]+\/embed\//i, name: 'codepen' },
  { pattern: /open\.spotify\.com\/embed\//i, name: 'spotify' },
  { pattern: /w\.soundcloud\.com\/player/i, name: 'soundcloud' },
];

function toEmbedUrl(rawUrl: string): { url: string; provider: string } | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'youtu.be') {
      return {
        url: `https://www.youtube.com/embed${u.pathname}`,
        provider: 'youtube',
      };
    }
    if (/youtube\.com/.test(u.hostname)) {
      const v = u.searchParams.get('v');
      if (v)
        return {
          url: `https://www.youtube.com/embed/${v}`,
          provider: 'youtube',
        };
    }
    if (/^vimeo\.com$/.test(u.hostname)) {
      const id = u.pathname.replace(/\D/g, '');
      if (id)
        return {
          url: `https://player.vimeo.com/video/${id}`,
          provider: 'vimeo',
        };
    }
  } catch {}
  return null;
}

function renderSources(sources?: Array<{ src: string; type?: string }>): string {
  return (sources ?? [])
    .map((s) => `<source src="${s.src}"${s.type ? ` type="${s.type}"` : ''}>`)
    .join('');
}

export function preserveMediaEmbeds(html: string): string {
  let result = html;

  result = result.replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, (match) => {
    const openAttrs = match.match(/^<audio([^>]*)>/i)?.[1] ?? '';
    const src = openAttrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const sources: Array<{ src: string; type?: string }> = [];
    for (const m of match.matchAll(/<source[^>]+>/gi)) {
      const s = m[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const t = m[0].match(/\btype=["']([^"']+)["']/i)?.[1];
      if (s) sources.push(t ? { src: s, type: t } : { src: s });
    }
    if (!src && !sources.length) return match;
    const meta: AudioMeta = { kind: 'audio' };
    if (src) meta.src = src;
    if (sources.length) meta.sources = sources;
    return `<img src="${encodeMeta(meta)}" alt="audio">`;
  });

  result = result.replace(/<video[^>]*>[\s\S]*?<\/video>/gi, (match) => {
    const openAttrs = match.match(/^<video([^>]*)>/i)?.[1] ?? '';
    const src = openAttrs.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const poster = openAttrs.match(/\bposter=["']([^"']+)["']/i)?.[1];
    const sources: Array<{ src: string; type?: string }> = [];
    for (const m of match.matchAll(/<source[^>]+>/gi)) {
      const s = m[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const t = m[0].match(/\btype=["']([^"']+)["']/i)?.[1];
      if (s) sources.push(t ? { src: s, type: t } : { src: s });
    }
    if (!src && !sources.length) return match;
    const meta: VideoMeta = { kind: 'video' };
    if (src) meta.src = src;
    if (sources.length) meta.sources = sources;
    if (poster) meta.poster = poster;
    return `<img src="${encodeMeta(meta)}" alt="video">`;
  });

  result = result.replace(
    /<iframe[^>]+src=["']([^"']+)["'][^>]*>(?:<\/iframe>)?/gi,
    (match, src) => {
      const provider = embedProviders.find((p) => p.pattern.test(src));
      if (!provider) return match;
      const meta: IframeMeta = { kind: 'iframe', src, provider: provider.name };
      return `<img src="${encodeMeta(meta)}" alt="${provider.name} embed">`;
    },
  );

  result = result.replace(
    /<p([^>]+class=["'][^"']*\bcodepen\b[^"']*["'][^>]*)>[\s\S]*?<\/p>/gi,
    (match, attrs) => {
      const hashMatch = attrs.match(/data-slug-hash=["']([^"']+)["']/i);
      const userMatch = attrs.match(/data-user=["']([^"']+)["']/i);
      const heightMatch = attrs.match(/data-height=["']([^"']+)["']/i);
      if (!hashMatch || !userMatch) return match;
      const src = `https://codepen.io/${userMatch[1]}/embed/${hashMatch[1]}?default-tab=result&height=${heightMatch?.[1] ?? '450'}`;
      const meta: IframeMeta = { kind: 'iframe', src, provider: 'codepen' };
      return `<img src="${encodeMeta(meta)}" alt="codepen embed">`;
    },
  );

  result = result.replace(
    /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi,
    (match, href) => {
      const embed = toEmbedUrl(href);
      if (!embed) return match;
      const meta: IframeMeta = {
        kind: 'iframe',
        src: embed.url,
        provider: embed.provider,
      };
      return `<img src="${encodeMeta(meta)}" alt="${embed.provider} embed">`;
    },
  );

  return result;
}

export function restoreMediaEmbeds(content: string): string {
  const escaped = mediaBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(
    new RegExp(`<img[^>]+src="${escaped}([^"]+)"[^>]*>`, 'gi'),
    (_, encoded) => {
      try {
        const meta = JSON.parse(decodeURIComponent(encoded)) as MediaMeta;

        if (meta.kind === 'iframe') {
          const attrs = iframeAttrs[meta.provider] ?? iframeAttrs.embedly;
          const fixedHeight = iframeFixedHeight[meta.provider];
          const codepenHeight =
            meta.provider === 'codepen'
              ? (new URL(meta.src).searchParams.get('height') ?? '450')
              : null;
          const height = fixedHeight ?? codepenHeight;
          const style = height
            ? `width:100%;height:${height}px;border:0;overflow:hidden`
            : `width:100%;aspect-ratio:16/9;border:0`;
          const allowAttr = attrs.allow ? ` allow="${attrs.allow}"` : '';
          return `<iframe src="${meta.src}" loading="lazy" sandbox="${attrs.sandbox}"${allowAttr} style="${style}" allowfullscreen></iframe>`;
        }

        if (meta.kind === 'audio') {
          const srcAttr = meta.src ? ` src="${meta.src}"` : '';
          return `<audio controls${srcAttr} style="width:100%">${renderSources(meta.sources)}</audio>`;
        }

        if (meta.kind === 'video') {
          const srcAttr = meta.src ? ` src="${meta.src}"` : '';
          const posterAttr = meta.poster ? ` poster="${meta.poster}"` : '';
          return `<video controls${srcAttr}${posterAttr} style="width:100%;aspect-ratio:16/9">${renderSources(meta.sources)}</video>`;
        }

        return '';
      } catch {
        return '';
      }
    },
  );
}
