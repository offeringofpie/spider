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

export type { ParsedPost, ParseMeta, ParseAttempt };
