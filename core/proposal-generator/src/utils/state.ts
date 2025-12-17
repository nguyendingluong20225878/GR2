// Local lightweight type aliases to avoid importing shared runtime at build-time
type ProposalInsert = any;
type SignalSelect = any;
type TokenPriceSelect = any;
type TweetSelect = any;
type UserBalance = any;
type UserSelect = any;
type UserBalanceSelect = UserBalance;
import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, MemorySaver, messagesStateReducer } from "@langchain/langgraph";

export const memory = new MemorySaver();

export const proposalGeneratorState = Annotation({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  user: Annotation<UserSelect | null>({
    reducer: (oldValue: UserSelect | null, newValue: UserSelect | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // シグナル情報
  signal: Annotation<SignalSelect | null>({
    reducer: (oldValue: SignalSelect | null, newValue: SignalSelect | null) => newValue ?? oldValue,
    default: () => null,
  }),

  tokenPrices: Annotation<TokenPriceSelect[] | null>({
    reducer: (oldValue: TokenPriceSelect[] | null, newValue: TokenPriceSelect[] | null) => newValue ?? oldValue,
    default: () => null,
  }),

  latestTweets: Annotation<TweetSelect[] | null>({
    reducer: (oldValue: TweetSelect[] | null, newValue: TweetSelect[] | null) => newValue ?? oldValue,
    default: () => null,
  }),

  userBalance: Annotation<UserBalanceSelect | null>({
    reducer: (oldValue: UserBalanceSelect | null, newValue: UserBalanceSelect | null) => newValue ?? oldValue,
    default: () => null,
  }),

  proposal: Annotation<ProposalInsert | null>({
    reducer: (oldValue: ProposalInsert | null, newValue: ProposalInsert | null) => newValue ?? oldValue,
    default: () => null,
  }),
});
