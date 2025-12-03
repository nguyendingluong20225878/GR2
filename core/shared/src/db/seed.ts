import { connectToDatabase, disconnectFromDatabase, mongoose } from ".";
import { initialTokens, mockSignal, mockTokenPrices, mockTweets, mockUser, mockUserBalances, staticProposals } from "../constants";
import { logger } from "../utils";
import { setupInitialPortfolio } from "../utils/portfolio";
import { InterestRateInsert, interestRatesTable } from "./schema/interest_rates";
import { NewsSiteInsert, newsSiteTable } from "./schema/news_sites";
import { ProposalInsert, proposalTable } from "./schema/proposals";
import { SignalInsert, signalsTable } from "./schema/signals";
import { TokenInsert, tokensTable } from "./schema/tokens";
import { TokenPriceInsert, tokenPricesTable } from "./schema/token_prices";
import { TweetInsert, tweetTable } from "./schema/tweets";
import { UserDocument, UserInsert, usersTable } from "./schema/users";
import { XAccountInsert, xAccountTable } from "./schema/x_accounts";
import { Types } from "mongoose";

// Nếu muốn reset các collection trước khi seed, bật biến này
const RESET_BEFORE_SEED = false;

async function resetCollections() {
  const collections = [
    "users", "tokens", "proposals", "x_accounts",
    "news_sites", "token_prices", "tweets",
    "signals", "interest_rates"
  ];
  await connectToDatabase(); // Đảm bảo kết nối
  for (const name of collections) {
    const db = mongoose.connection.db; 
    await db!.collection(name).deleteMany({}); // FIX: Thêm ! cho db
    console.log(`Đã xóa collection: ${name}`);
  }
}

const seedUsers = async () => {
  try {
    // FIX: Loại bỏ khai báo type trên dòng định nghĩa và cast toàn bộ array sau đó
    const users = [
      {
        name: "Nguyễn Văn A", age: 30, email: "nguyenvana@example.com", tradeStyle: "conservative",
        totalAssetUsd: 1000000, cryptoInvestmentUsd: 100000, walletAddress: "Fgkki5sVbKpdLF28nvahDyrYeUQ5Cn7VJ8WTXHzLWEB5",
        // FIX: Sửa lỗi Type 'undefined' is not assignable to type 'NativeDate'. Dùng null as any
        emailVerified: null as any, 
        riskTolerance: "medium", notificationEnabled: false, 
        balances: [] as any, // FIX: Sử dụng as any cho mảng rỗng
      },
      {
        name: "Trần Thị B", age: 25, email: "tranthib@example.com", tradeStyle: "moderate",
        totalAssetUsd: 1000000, cryptoInvestmentUsd: 100000, walletAddress: "6R57iMy4cxpMBWu6wNP8648HoTEbim8fDK2ZWFdYPJ5D",
        // FIX
        emailVerified: null as any, 
        riskTolerance: "medium", notificationEnabled: false, 
        balances: [] as any,
      },
      {
        name: "Lê Văn C", age: 35, email: "levanc@example.com", tradeStyle: "aggressive",
        totalAssetUsd: 1000000, cryptoInvestmentUsd: 100000, walletAddress: "6yVF82TqGTwvix2tCGzxUhWGKkBB185sTU7A2bvACnF2",
        // FIX
        emailVerified: null as any, 
        riskTolerance: "medium", notificationEnabled: false, 
        balances: [] as any,
      },
    ] as UserInsert[]; // FIX: Cast toàn bộ array để giải quyết lỗi index signature

    console.log("Đang chèn dữ liệu người dùng...");

    const generatedUsers: UserDocument[] = [];

    for (const user of users) {
      let existingUser = await usersTable.findOne({ email: user.email });
      if (!existingUser) {
        existingUser = await usersTable.create(user);
        console.log(`Đã chèn người dùng: "${user.name}"`);
      } else {
        console.log(`Người dùng "${user.name}" (${user.email}) đã tồn tại. Bỏ qua.`);
      }
      generatedUsers.push(existingUser);
    }

    return generatedUsers;
  } catch (error) {
    console.error("Lỗi khi chèn dữ liệu người dùng:", error);
    throw error;
  }
};

const seedProposals = async (generatedUsers: UserDocument[]) => {
  try {
    logger.debug("seedProposals", "Chuẩn bị chèn proposals...");

    const allPotentialProposals: ProposalInsert[] = generatedUsers.flatMap((user) =>
      staticProposals.map((staticProposal) => ({
        ...staticProposal,
        userId: user._id, // userId trong ProposalInsert là Types.ObjectId
      }))
    ) as ProposalInsert[];

    if (allPotentialProposals.length === 0) return;

    // FIX: Sử dụng as unknown as để giải quyết lỗi casting nghiêm ngặt của lean()
    const existingProposals = await proposalTable.find({}, { title: 1, userId: 1 }).lean() as unknown as Array<{ title: string; userId: Types.ObjectId }>;
    
    // Sửa lỗi: Dùng .toString() để so sánh ObjectId
    const existingSet = new Set(existingProposals.map(p => `${p.title}-${p.userId.toString()}`));

    // Sửa lỗi: Dùng .toString() khi so sánh userId
    const proposalsToInsert = allPotentialProposals.filter(p => !existingSet.has(`${p.title}-${p.userId.toString()}`));

    if (proposalsToInsert.length === 0) {
      logger.info("seedProposals", "Tất cả proposals đã tồn tại.");
      return;
    }

    await proposalTable.insertMany(proposalsToInsert as ProposalInsert[], { ordered: false });

    proposalsToInsert.forEach(p => {
      // Sửa lỗi: Dùng .toString() để so sánh ObjectId
      const user = generatedUsers.find(u => u._id.toString() === p.userId.toString());
      console.log(`Đã chèn proposal "${p.title}" cho người dùng "${user ? user.name : 'Unknown'}"`);
    });
  } catch (error) {
    logger.error("seedProposals", "Lỗi khi chèn proposals:", error);
    throw error;
  }
};

const seedMockUser = async (): Promise<UserDocument | null> => {
  const existingUser = await usersTable.findOne({ email: mockUser.email });
  if (existingUser) return existingUser;

  // Khởi tạo mockUser với các trường cần thiết để khớp với UserInsert schema
  const userToCreate: UserInsert = {
    ...mockUser,
    emailVerified: mockUser.emailVerified, 
    // FIX: mockUser không có balances. Khởi tạo là empty array.
    balances: [] as any, 
    riskTolerance: mockUser.riskTolerance,
    notificationEnabled: mockUser.notificationEnabled,
    image: mockUser.image,
    age: mockUser.age,
    tradeStyle: mockUser.tradeStyle,
    totalAssetUsd: mockUser.totalAssetUsd,
    cryptoInvestmentUsd: mockUser.cryptoInvestmentUsd,
    walletAddress: mockUser.walletAddress,
  } as UserInsert;
  
  const createdUser = await usersTable.create(userToCreate);
  console.log(`Đã chèn mock user "${mockUser.name}"`);
  return createdUser;
};

const seedMockUserBalances = async (userId: string): Promise<void> => {
  const user = await usersTable.findById(userId);
  if (!user) return;

  const balancesToInsert = mockUserBalances.map(b => ({
    tokenAddress: b.tokenAddress,
    balance: b.balance,
    updatedAt: b.updatedAt,
  }));

  await usersTable.findByIdAndUpdate(userId, { $set: { balances: balancesToInsert } }, { new: true });
  console.log(`Đã chèn ${mockUserBalances.length} mock user balances cho user ${userId}`);
};

const seedMockTokenPrices = async (): Promise<void> => {
  for (const price of mockTokenPrices) {
    const existingPrice = await tokenPricesTable.findOne({ tokenAddress: price.tokenAddress });
    if (!existingPrice) {
      await tokenPricesTable.create(price);
      console.log(`Đã chèn giá token mock cho ${price.tokenAddress}`);
    }
  }
};

const seedMockTweets = async (): Promise<void> => {
  for (const tweet of mockTweets) {
    const existingTweet = await tweetTable.findOne({ url: tweet.url });
    if (!existingTweet) {
      await tweetTable.create(tweet);
      console.log(`Đã chèn tweet ${tweet.url}`);
    }
  }
};

const seedMockSignal = async (): Promise<void> => {
  const existingSignal = await signalsTable.findOne({
    tokenAddress: mockSignal.tokenAddress,
    detectedAt: mockSignal.detectedAt,
  });
  if (!existingSignal) {
    await signalsTable.create(mockSignal);
    console.log(`Đã chèn mock signal cho token ${mockSignal.tokenAddress}`);
  }
};

async function seed() {
  await connectToDatabase();

  if (RESET_BEFORE_SEED) await resetCollections();

  const users = await seedUsers();
  await seedProposals(users as UserDocument[]);

  const mockUserDoc = await seedMockUser();
  if (mockUserDoc) {
    await seedMockUserBalances(mockUserDoc._id.toString());
  }

  await seedMockTokenPrices();
  await seedMockTweets();
  await seedMockSignal();

  console.log("Seed dữ liệu hoàn tất!");
    await disconnectFromDatabase();
}

seed().catch(err => {
  console.error("Seed thất bại:", err);
  });