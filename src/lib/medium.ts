const imageWidth = 700;
const graphqlEndpoint = 'https://medium.com/_/graphql';
const mediumUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1 (compatible; YandexMobileBot/3.0;';

const postIdPattern = /^[0-9a-f]{8,12}$/i;

const mediumHosts = new Set([
  'medium.com',
  'towardsdatascience.com',
  'uxdesign.cc',
  'uxplanet.org',
  'levelup.gitconnected.com',
  'betterprogramming.pub',
  'itnext.io',
  'codeburst.io',
  'infosecwriteups.com',
  'towardsdev.com',
  'javascript.plainenglish.io',
  'ai.plainenglish.io',
  'python.plainenglish.io',
  'blog.stackademic.com',
  'blog.devops.dev',
  'ai.gopubby.com',
  'generativeai.pub',
  'bettermarketing.pub',
  'entrepreneurshandbook.co',
  'blog.llamaindex.ai',
  'medium.datadriveninvestor.com',
]);

type Markup = {
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly href?: string;
  readonly title?: string;
  readonly anchorType?: string;
  readonly userId?: string;
};

type Paragraph = {
  readonly type: string;
  readonly text?: string;
  readonly markups?: readonly Markup[];
  readonly metadata?: { id?: string; alt?: string };
  readonly iframe?: { mediaResource?: { id?: string; iframeSrc?: string } };
  readonly mixtapeMetadata?: { href?: string };
  readonly codeBlockMetadata?: { lang?: string };
};

type Post = {
  readonly title?: string;
  readonly detectedLanguage?: string;
  readonly firstPublishedAt?: number;
  readonly creator?: { name?: string };
  readonly previewImage?: { id?: string };
  readonly content?: { bodyModel?: { paragraphs?: readonly Paragraph[] } };
};

const fullPostQuery = `query FullPostQuery($postId: ID!, $postMeteringOptions: PostMeteringOptions) {
  post(id: $postId) {
    id
    title
    detectedLanguage
    firstPublishedAt
    isLocked
    creator { name }
    previewImage { id }
    content(postMeteringOptions: $postMeteringOptions) {
      bodyModel {
        paragraphs {
          name
          type
          text
          markups { type start end href title anchorType userId }
          metadata { id originalWidth originalHeight alt }
          iframe { mediaResource { id iframeSrc } }
          mixtapeMetadata { href thumbnailImageId }
          codeBlockMetadata { lang mode }
        }
      }
    }
  }
}`;

function mediumPostId(url: URL): string | null {
  if (url.pathname.startsWith('/p/')) {
    const id = url.pathname.slice(3).split('/')[0];
    return postIdPattern.test(id) ? id : null;
  }
  const last = url.pathname.split('/').filter(Boolean).pop();
  const id = last?.split('-').pop();
  return id && postIdPattern.test(id) ? id : null;
}

function isMedium(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');
    const known =
      host === 'medium.com' ||
      host.endsWith('.medium.com') ||
      mediumHosts.has(host);
    return known && mediumPostId(url) !== null;
  } catch {
    return false;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function openTag(markup: Markup): string {
  switch (markup.type) {
    case 'STRONG':
      return '<strong>';
    case 'EM':
      return '<em>';
    case 'CODE':
      return '<code>';
    case 'A': {
      if (markup.anchorType === 'USER' && markup.userId) {
        return `<a href="https://medium.com/u/${markup.userId}">`;
      }
      if (markup.href) {
        const title = markup.title ? ` title="${escapeAttr(markup.title)}"` : '';
        return `<a href="${escapeAttr(markup.href)}"${title}>`;
      }
      return '';
    }
    default:
      return '';
  }
}

function closeTag(markup: Markup): string {
  switch (markup.type) {
    case 'STRONG':
      return '</strong>';
    case 'EM':
      return '</em>';
    case 'CODE':
      return '</code>';
    case 'A':
      return openTag(markup) ? '</a>' : '';
    default:
      return '';
  }
}

function inline(paragraph: Paragraph): string {
  const text = paragraph.text ?? '';
  const markups = (paragraph.markups ?? []).filter((m) => openTag(m) !== '');
  if (markups.length === 0) {
    return escapeHtml(text);
  }

  const bounds = new Set([0, text.length]);
  for (const markup of markups) {
    bounds.add(Math.max(0, Math.min(markup.start, text.length)));
    bounds.add(Math.max(0, Math.min(markup.end, text.length)));
  }
  const points = [...bounds].sort((a, b) => a - b);

  let out = '';
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const active = markups.filter((m) => m.start <= from && m.end >= to);
    const opens = active.map(openTag).join('');
    const closes = active
      .slice()
      .reverse()
      .map(closeTag)
      .join('');
    out += opens + escapeHtml(text.slice(from, to)) + closes;
  }
  return out;
}

function renderImg(paragraph: Paragraph): string {
  const id = paragraph.metadata?.id;
  if (!id) {
    return '';
  }
  const src = `https://miro.medium.com/v2/resize:fit:${imageWidth}/${id}`;
  const alt = escapeAttr(paragraph.metadata?.alt ?? '');
  const caption = paragraph.text
    ? `<figcaption>${inline(paragraph)}</figcaption>`
    : '';
  return `<figure><img src="${src}" alt="${alt}">${caption}</figure>`;
}

function renderIframe(paragraph: Paragraph): string {
  const resource = paragraph.iframe?.mediaResource;
  if (!resource) {
    return '';
  }
  const src =
    resource.iframeSrc && resource.iframeSrc.length > 0
      ? resource.iframeSrc
      : resource.id
        ? `https://medium.com/media/${resource.id}`
        : null;
  if (!src) {
    return '';
  }
  return `<iframe src="${escapeAttr(src)}" frameborder="0" allowfullscreen></iframe>`;
}

function renderMixtape(paragraph: Paragraph): string {
  const href = paragraph.mixtapeMetadata?.href;
  if (!href) {
    return paragraph.text ? `<p>${inline(paragraph)}</p>` : '';
  }
  const label = inline(paragraph) || escapeHtml(href);
  return `<p><a href="${escapeAttr(href)}">${label}</a></p>`;
}

function renderBlock(paragraph: Paragraph): string {
  switch (paragraph.type) {
    case 'H1':
      return `<h1>${inline(paragraph)}</h1>`;
    case 'H2':
      return `<h2>${inline(paragraph)}</h2>`;
    case 'H3':
      return `<h3>${inline(paragraph)}</h3>`;
    case 'H4':
      return `<h4>${inline(paragraph)}</h4>`;
    case 'BQ':
    case 'PQ':
      return `<blockquote>${inline(paragraph)}</blockquote>`;
    case 'IMG':
      return renderImg(paragraph);
    case 'IFRAME':
      return renderIframe(paragraph);
    case 'MIXTAPE_EMBED':
      return renderMixtape(paragraph);
    default:
      return paragraph.text ? `<p>${inline(paragraph)}</p>` : '';
  }
}

function renderParagraphs(paragraphs: readonly Paragraph[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < paragraphs.length) {
    const type = paragraphs[i].type;

    if (type === 'ULI' || type === 'OLI') {
      const tag = type === 'ULI' ? 'ul' : 'ol';
      const items: string[] = [];
      while (i < paragraphs.length && paragraphs[i].type === type) {
        items.push(`<li>${inline(paragraphs[i])}</li>`);
        i++;
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    if (type === 'PRE') {
      const lang = paragraphs[i].codeBlockMetadata?.lang;
      const lines: string[] = [];
      while (i < paragraphs.length && paragraphs[i].type === 'PRE') {
        lines.push(escapeHtml(paragraphs[i].text ?? ''));
        i++;
      }
      const cls = lang ? ` class="language-${lang}"` : '';
      out.push(`<pre><code${cls}>${lines.join('\n')}</code></pre>`);
      continue;
    }

    out.push(renderBlock(paragraphs[i]));
    i++;
  }
  return out.filter(Boolean).join('\n');
}

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (b) => b.toString(16).padStart(2, '0')).join('');
}

function mediumHeaders(): Record<string, string> {
  return {
    'X-APOLLO-OPERATION-ID': randomHex(32),
    'X-APOLLO-OPERATION-NAME': 'FullPostQuery',
    Accept:
      'multipart/mixed; deferSpec=20220824, application/json, application/json',
    'Accept-Language': 'en-US',
    'X-Obvious-CID': 'android',
    'X-Xsrf-Token': '1',
    'X-Client-Date': String(Date.now()),
    'User-Agent': mediumUserAgent,
    'Cache-Control': 'public, max-age=-1',
    'Content-Type': 'application/json',
    Connection: 'Keep-Alive',
  };
}

type MediumContent = {
  readonly content: string;
  readonly title: string | null;
  readonly author: string | null;
  readonly datePublished: string | null;
  readonly leadImageUrl: string | null;
  readonly lang: string | null;
};

async function fetchMediumContent(
  url: URL,
  timeout: number,
): Promise<MediumContent | null> {
  const postId = mediumPostId(url);
  if (!postId) {
    return null;
  }

  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: mediumHeaders(),
    body: JSON.stringify({
      operationName: 'FullPostQuery',
      variables: { postId, postMeteringOptions: {} },
      query: fullPostQuery,
    }),
    signal: AbortSignal.timeout(Math.min(timeout, 8000)),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const json = (await response.json()) as { data?: { post?: Post } };
  const post = json.data?.post;
  const paragraphs = post?.content?.bodyModel?.paragraphs;
  if (!post || !paragraphs || paragraphs.length === 0) {
    return null;
  }

  const content = renderParagraphs(paragraphs);
  if (!content.trim()) {
    return null;
  }

  return {
    content,
    title: post.title ?? null,
    author: post.creator?.name ?? null,
    datePublished: post.firstPublishedAt
      ? new Date(post.firstPublishedAt).toISOString()
      : null,
    leadImageUrl: post.previewImage?.id
      ? `https://miro.medium.com/v2/resize:fit:${imageWidth}/${post.previewImage.id}`
      : null,
    lang: post.detectedLanguage ?? null,
  };
}

export { isMedium, mediumPostId, fetchMediumContent };
