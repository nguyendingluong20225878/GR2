
import {
  XAccountInsert,
  XAccountRepository, // Import interface từ shared
  XAccountSelect,     // Import type từ shared (HydratedDocument<XAccountSchema>)
  xAccountTable,      // Import Mongoose Model từ shared/src/db/schema/x_accounts.ts
} from "../../../shared/src";
// XAccountSelect là HydratedDocument, nên có thể dùng ._id
export class MongoXAccountRepository implements XAccountRepository {
  async findAll(): Promise<XAccountSelect[]> {
    // Dùng .find() của Mongoose
    const accounts = await xAccountTable.find().exec();//trả về promise
    return accounts as XAccountSelect[];
  }

  /**
   * Tìm tài khoản theo ID
   * Lưu ý: Trong Mongoose, _id (String) là trường chính
   */
  async findById(id: string): Promise<XAccountSelect | null> {
    // Dùng .findById() của Mongoose
    const account = await xAccountTable.findById(id).exec();
    return (account as XAccountSelect) || null;
  }

  
  /**
   * Tạo hoặc cập nhật tài khoản X
   */
  async create(data: XAccountInsert): Promise<XAccountSelect> {
    // Dùng .create() của Mongoose
    const account = await xAccountTable.create(data);
    return account as XAccountSelect;
  }

  async update(id: string, data: Partial<XAccountSelect>): Promise<void> {
    // Dùng updateOne để chỉ cập nhật các trường được truyền vào
    const updateData: any = { ...data };
    
    await xAccountTable.updateOne(
      { _id: id },
      { $set: updateData, updatedAt: new Date() },
    ).exec();
  }
  
  async delete(id: string): Promise<void> {
     await xAccountTable.deleteOne({ _id: id }).exec();
  }

  /**
   * Tìm tài khoản theo userId
   */
  async findByUserId(userId: string): Promise<XAccountSelect[]> {
    const accounts = await xAccountTable.find({ userIds: userId }).exec();
    return accounts as XAccountSelect[];
  }

  /**
   * Tìm tài khoản theo điều kiện (field operator value)
   */
  async findWhere<K extends keyof XAccountSelect>(
    field: K,
    operator: string,
    value: XAccountSelect[K]
  ): Promise<XAccountSelect[]> {
    const query: any = {};
    query[field] = {};
    query[field][operator] = value;
    
    const accounts = await xAccountTable.find(query).exec();
    return accounts as XAccountSelect[];
  }

  //Cập nhật thời gian tweet mới nhất
  async updateLastTweetUpdatedAt(accountId: string, tweetTimestamp: Date): Promise<void> {
    // Dùng Mongoose: updateOne
    await xAccountTable.updateOne(
      { _id: accountId },
      { lastTweetUpdatedAt: tweetTimestamp, updatedAt: new Date() },
    ).exec();
  }

  /**
   * Thêm userId vào mảng userIds của tài khoản
   */
  async addUser(accountId: string, userId: string): Promise<void> {
    await xAccountTable.updateOne(
      { _id: accountId },
      { $addToSet: { userIds: userId }, updatedAt: new Date() }
    ).exec();
  }

  /**
   * Xóa userId khỏi mảng userIds của tài khoản
   */
  async removeUser(accountId: string, userId: string): Promise<void> {
    await xAccountTable.updateOne(
      { _id: accountId },
      { $pull: { userIds: userId }, updatedAt: new Date() }
    ).exec();
  }
}