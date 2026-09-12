type ParseAttempt =
  | {
      readonly status: 'failure';
      readonly step: string;
      readonly error: string;
    }
  | { readonly status: 'partial'; readonly step: string }
  | {
      readonly status: 'skipped';
      readonly step: string;
      readonly reason: string;
    };

export type { ParseAttempt };
