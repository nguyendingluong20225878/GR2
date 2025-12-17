import { initialTokens, mockTweets } from "../../shared/src/constants";
import type { FormattedTweetForLlm, KnownTokenType } from "../src/types";

export const mockTweetsForDetector: FormattedTweetForLlm[] = mockTweets.map((tweet: any) => ({
  text: tweet.content,
  author: tweet.authorId,
  time: tweet.tweetTime.toISOString(),
  id: tweet.id ?? `${tweet.authorId}-${tweet.tweetTime.getTime()}`,
  url: tweet.url,
}));

export const mockKnownTokens: KnownTokenType[] = initialTokens.map((token: any) => ({
  address: token.address,
  symbol: token.symbol,
  name: token.name,
}));
