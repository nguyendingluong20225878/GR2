import type { XAccountSchema } from "../../db/schema/x_accounts";
import { Repository } from "./Repository";

export type XAccountSelect = XAccountSchema;
export type XAccountInsert = XAccountSchema;

export interface XAccountRepository
  extends Repository<XAccountSelect, XAccountInsert> {

  findByUserId(userId: string): Promise<XAccountSelect[]>;

  updateLastTweetUpdatedAt(
    accountId: string,
    tweetTimestamp: Date
  ): Promise<void>;

  addUser(accountId: string, userId: string): Promise<void>;

  removeUser(accountId: string, userId: string): Promise<void>;
}
