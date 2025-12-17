// packages/x-scraper/src/repositories/MongoTweetRepository.ts

import {
  TweetInsert,
  TweetRepository, // Import interface từ shared
  TweetSelect,     // Import type từ shared (HydratedDocument<TweetSchema>)
  tweetTable,      // Import Mongoose Model từ shared/src/db/schema/tweets.ts
} from "../../../shared/src";

export class MongoTweetRepository implements TweetRepository {

  // Triển khai các phương thức đơn giản: findAll, findById, update, delete
  async findAll(): Promise<TweetSelect[]> {
    return (await tweetTable.find().exec()) as TweetSelect[];
  }

  async findById(id: string): Promise<TweetSelect | null> {
    return (await tweetTable.findById(id).exec()) as TweetSelect | null;
  }

  /**
   * Tạo một Tweet mới
   */
  async create(data: TweetInsert): Promise<TweetSelect> {
    // Dùng .create() của Mongoose
    const tweet = await tweetTable.create(data);
    return tweet as TweetSelect;
  }

  async update(id: string, data: Partial<TweetSelect>): Promise<void> {
    await tweetTable.updateOne({ _id: id }, { $set: data, updatedAt: new Date() }).exec();
  }

  async delete(id: string): Promise<void> {
    await tweetTable.deleteOne({ _id: id }).exec();
  }

  // Phương thức lấy Tweet theo AuthorId (cần cho việc kiểm tra)
  async findByAccountId(accountId: string, limit?: number): Promise<TweetSelect[]> {
    let query = tweetTable.find({ authorId: accountId }).sort({ tweetTime: -1 }); // Sắp xếp giảm dần theo thời gian tweet
    if (limit) {
      query = query.limit(limit);
    }
    return (await query.exec()) as TweetSelect[];
  }

  /**
   * Lấy Tweet mới nhất của tài khoản
   */
  async findLatestByAccountId(accountId: string): Promise<TweetSelect | null> {
    const tweet = await tweetTable
      .findOne({ authorId: accountId })
      .sort({ tweetTime: -1 })
      .exec();
    return (tweet as TweetSelect) || null;
  }

  /**
   * Tìm Tweet theo điều kiện (field operator value)
   */
  async findWhere<K extends keyof TweetSelect>(
    field: K,
    operator: string,
    value: TweetSelect[K]
  ): Promise<TweetSelect[]> {
    const query: any = {};
    query[field] = {};
    query[field][operator] = value;
    
    const tweets = await tweetTable.find(query).exec();
    return tweets as TweetSelect[];
  }
}