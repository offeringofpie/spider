type ParsedPost = {
  readonly title: string | null;
  readonly content: string;
  readonly url: string;
  readonly author: string | null;
  readonly word_count: number | null;
  readonly date_published: string | null;
  readonly lead_image_url: string | null;
  readonly dek: string | null;
  readonly excerpt: string | null;
  readonly lang: string | null;
};

type ParseMeta = {
  readonly originalUrl: string;
  readonly fetchedUrl: string;
  readonly strategy: string;
  readonly contentLength: number;
  readonly paywalled: boolean;
  readonly source: 'live' | 'cache' | 'client';
};

type ParseAttempt =
  | {
      readonly status: 'success';
      readonly step: string;
      readonly ms: number;
      readonly words: number;
    }
  | {
      readonly status: 'partial';
      readonly step: string;
      readonly ms: number;
    }
  | {
      readonly status: 'failure';
      readonly step: string;
      readonly error: string;
      readonly ms: number;
    }
  | {
      readonly status: 'skipped';
      readonly step: string;
      readonly reason: string;
    };

type ParseResult =
  | {
      readonly kind: 'article';
      readonly post: ParsedPost;
      readonly meta: ParseMeta;
      readonly attempts: readonly ParseAttempt[];
      readonly confident: boolean;
    }
  | {
      readonly kind: 'failure';
      readonly error: string;
      readonly suggestion: string;
      readonly url: string;
      readonly attempts: readonly ParseAttempt[];
    };

type ParseEvent =
  | { readonly type: 'step'; readonly step: string; readonly at: number }
  | { readonly type: 'attempt'; readonly attempt: ParseAttempt }
  | {
      readonly type: 'article';
      readonly stage: 'draft' | 'final';
      readonly post: ParsedPost;
      readonly meta: ParseMeta;
    }
  | { readonly type: 'done'; readonly attempts: readonly ParseAttempt[] }
  | {
      readonly type: 'failed';
      readonly error: string;
      readonly suggestion: string;
      readonly url: string;
      readonly attempts: readonly ParseAttempt[];
    };

export type {
  ParsedPost,
  ParseMeta,
  ParseAttempt,
  ParseResult,
  ParseEvent,
};
