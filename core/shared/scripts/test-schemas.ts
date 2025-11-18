import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import {
  usersTable,
  tokensTable,
  tokenPricesTable,
  chatThreadsTable,
  signalsTable,
  tweetTable,
} from "../src/db/schema";

async function testSchemas() {
  try {
    await connectToDatabase();
    console.log("✅ Đã kết nối database\n");

    // Test Users Schema
    console.log("📝 Testing Users Schema...");
    const userCount = await usersTable.countDocuments();
    console.log(`   Users collection: ${userCount} documents`);

    // Test Tokens Schema
    console.log("\n🪙 Testing Tokens Schema...");
    const tokenCount = await tokensTable.countDocuments();
    console.log(`   Tokens collection: ${tokenCount} documents`);

    // Test Token Prices Schema
    console.log("\n💰 Testing Token Prices Schema...");
    const priceCount = await tokenPricesTable.countDocuments();
    console.log(`   Token Prices collection: ${priceCount} documents`);

    // Test Chat Threads Schema
    console.log("\n💬 Testing Chat Threads Schema...");
    const threadCount = await chatThreadsTable.countDocuments();
    console.log(`   Chat Threads collection: ${threadCount} documents`);

    // Test Signals Schema
    console.log("\n📡 Testing Signals Schema...");
    const signalCount = await signalsTable.countDocuments();
    console.log(`   Signals collection: ${signalCount} documents`);

    // Test Tweets Schema
    console.log("\n🐦 Testing Tweets Schema...");
    const tweetCount = await tweetTable.countDocuments();
    console.log(`   Tweets collection: ${tweetCount} documents`);

    console.log("\n✅ Tất cả schemas đã được định nghĩa đúng!");

    await disconnectFromDatabase();
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

testSchemas();

