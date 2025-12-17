import { TweetRepository, XAccountRepository } from "../../../shared/src";
// Thay đổi import từ Postgres sang Mongo
import { MongoTweetRepository } from "./MongoTweetRepository";
import { MongoXAccountRepository } from "./MongoXAccountRepository";

/**
 * Lớp Factory quản lý việc tạo ra các repository.
 * Đảm bảo kiến trúc sạch sẽ (Clean Architecture) cho phép thay đổi DB dễ dàng.
 */
export class RepositoryFactory {
  private static instance: RepositoryFactory;

  private constructor() {}

  /**
   * Lấy instance Singleton của Factory
   */
  public static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  /**
   * Lấy instance XAccountRepository 
   */
  public getXAccountRepository(): XAccountRepository {
    return new MongoXAccountRepository(); // Khởi tạo Mongo version
  }

  /**
   * Lấy instance TweetRepository 
   */
  public getTweetRepository(): TweetRepository {
    return new MongoTweetRepository(); // Khởi tạo Mongo version
  }
}

// Export instance mặc định để dễ sử dụng
export const repositoryFactory = RepositoryFactory.getInstance();