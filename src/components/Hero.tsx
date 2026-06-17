import { defaultStore, useStore } from '../store/store';

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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

export default function Hero() {
  const [state] = useStore(defaultStore);

  if (state.document.kind !== 'loaded') return null;

  const { post, leadImageUrl } = state.document;

  if (!leadImageUrl) {
    return (
      <div className="relative max-w-4xl mx-auto px-6 pt-10">
        <h1 className="font-semibold tracking-tight text-3xl md:text-4xl text-info mb-4">
          {post.title}
        </h1>
        <div className="mb-6 flex flex-wrap items-center justify-between text-sm text-slate-300">
          {post.word_count && <p>{readTime(post.word_count)} read time</p>}
          {post.date_published && (
            <time className="mt-2 md:mt-0" dateTime={post.date_published}>
              {formatDate(post.date_published)}
            </time>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ minHeight: '380px' }}>
      <div
        className="inset-0 absolute max-w-full -z-1 bg-cover bg-center"
        style={{
          height: '600px',
          backgroundImage: `url(${leadImageUrl})`,
          filter: 'blur(12px) brightness(0.3) saturate(1.4)',
          maskImage: 'linear-gradient(to bottom, black 55%, transparent 90%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 55%, transparent 90%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 pt-10 pb-4 flex flex-col md:flex-row gap-8 items-start">
        <img
          src={leadImageUrl}
          alt={post.title ?? ''}
          className="w-full md:w-1/2 rounded-xl shadow-2xl object-cover shrink-0"
          style={{ maxHeight: '220px' }}
        />

        <div className="flex-1 text-white min-w-0">
          <h1 className="font-semibold tracking-tight text-2xl md:text-3xl drop-shadow-lg mb-4">
            {post.title}
          </h1>
          {(post.dek || post.excerpt) && (
            <p className="text-slate-300 text-sm line-clamp-3">
              {post.dek || post.excerpt}
            </p>
          )}
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto px-6 pb-10 flex justify-between text-sm text-slate-400">
        {post.word_count && <span>{readTime(post.word_count)} read time</span>}
        {post.date_published && (
          <time dateTime={post.date_published}>
            {formatDate(post.date_published)}
          </time>
        )}
      </div>
    </div>
  );
}
