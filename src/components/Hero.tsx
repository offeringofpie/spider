import { useState, useEffect } from 'react';
import { defaultStore, useStore } from '../store/store';
import type { ParsedPost } from '../store/store';

const readTime = (wordCount: number) => {
  const wordsPerMinute = 200;
  const minutes = wordCount / wordsPerMinute;
  if (minutes < 1) {
    const seconds = Math.ceil(minutes * 60);
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const roundedMinutes = Math.ceil(minutes);
  return `${roundedMinutes} minute${roundedMinutes !== 1 ? 's' : ''}`;
};

const stripSiteSuffix = (title: string, url: string) => {
  const match = title.match(/^(.*?)\s+[-|–—]\s+([^-|–—]+)$/);
  if (!match) return title;

  const normalise = (s: string) => {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  try {
    const host = normalise(new URL(url).hostname.replace(/^www\./, ''));
    const suffix = normalise(match[2]);
    return suffix && host.includes(suffix) ? match[1] : title;
  } catch {
    return title;
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

const hostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

function Meta({ post }: { post: ParsedPost }) {
  const domain = hostname(post.url);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/60">
      {domain && <span className="truncate max-w-full">{domain}</span>}
      {post.author && (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate max-w-full">{post.author}</span>
        </>
      )}
      {post.word_count && (
        <>
          <span aria-hidden="true">·</span>
          <span>{readTime(post.word_count)} read time</span>
        </>
      )}
      {post.date_published && (
        <>
          <span aria-hidden="true">·</span>
          <time dateTime={post.date_published}>
            {formatDate(post.date_published)}
          </time>
        </>
      )}
      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="themed-link ms-auto text-base-content underline whitespace-nowrap"
      >
        View original
      </a>
    </div>
  );
}

export default function Hero() {
  const [state] = useStore(defaultStore);
  const [imageFailed, setImageFailed] = useState(false);

  const doc = state.document;
  const sourceUrl = doc.kind === 'loaded' ? doc.post.url : null;

  useEffect(() => {
    setImageFailed(false);
  }, [sourceUrl]);

  if (doc.kind !== 'loaded') return null;

  const { post } = doc;
  const leadImageUrl = imageFailed ? null : doc.leadImageUrl;
  const title = post.title ? stripSiteSuffix(post.title, post.url) : '';

  if (!leadImageUrl) {
    return (
      <div className="relative max-w-4xl mx-auto px-4 pt-10">
        <h1 className="font-semibold tracking-tight text-3xl md:text-4xl text-base-content mb-4">
          {title}
        </h1>
        <div className="mb-6">
          <Meta post={post} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ minHeight: '380px' }}>
      <div
        className="hero-backdrop inset-0 absolute max-w-full -z-1 bg-cover bg-center"
        style={{
          height: '600px',
          backgroundImage: `url(${leadImageUrl})`,
          filter: 'blur(12px) brightness(0.3) saturate(1.4)',
          maskImage: 'linear-gradient(to bottom, black 55%, transparent 90%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 55%, transparent 90%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-4 pt-10 pb-4 flex flex-col md:flex-row gap-8 items-start">
        <img
          src={leadImageUrl}
          alt=""
          fetchPriority="high"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="w-full md:w-1/2 rounded-xl shadow-2xl object-cover shrink-0"
          style={{ height: '220px' }}
        />

        <div className="flex-1 text-base-content min-w-0">
          <h1 className="font-semibold tracking-tight text-2xl md:text-3xl drop-shadow-lg mb-4">
            {title}
          </h1>
          {(post.dek || post.excerpt) && (
            <p className="text-base-content/70 text-sm line-clamp-3">
              {post.dek || post.excerpt}
            </p>
          )}
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 pb-10">
        <Meta post={post} />
      </div>
    </div>
  );
}
