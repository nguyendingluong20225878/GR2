// shared/src/types/x-account.ts

export interface XAccount {
    id: string;
    displayName?: string;
    profileImageUrl?: string;
    lastTweetUpdatedAt: Date | null;
  }
  