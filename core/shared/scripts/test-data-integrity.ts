import { connectToDatabase, disconnectFromDatabase } from "../src/db";
import {
  usersTable,
  tokenPricesTable,
  signalsTable,
  tweetTable,
} from "../src/db/schema";
import { mockUser, mockTokenPrices, mockSignal, mockTweets } from "../src/constants";

async function testDataIntegrity() {
  try {
    await connectToDatabase();
    console.log("✅ Đã kết nối database\n");

    // Test 1: Mock User
    console.log(" Test 1: Mock User");
    const user = await usersTable.findOne({ email: mockUser.email });
    if (user) {
      console.log("   ✅ Mock user tồn tại:", user.name);
      console.log("    Balances:", user.balances?.length || 0, "tokens");
    } else {
      console.log("   ❌ Mock user không tồn tại");
      console.log("   💡 Chạy: npm run db:seed để seed data");
    }

    // Test 2: Mock Token Prices
    console.log("\n Test 2: Mock Token Prices");
    for (const mockPrice of mockTokenPrices) {
      const price = await tokenPricesTable.findOne({
        tokenAddress: mockPrice.tokenAddress,
      });
      if (price) {
        console.log(`   ✅ Price cho ${mockPrice.tokenAddress}: $${price.priceUsd}`);
      } else {
        console.log(`   ❌ Price cho ${mockPrice.tokenAddress} không tồn tại`);
      }
    }

    // Test 3: Mock Signal
    console.log("\n Test 3: Mock Signal");
    const signal = await signalsTable.findOne({
      tokenAddress: mockSignal.tokenAddress,
    });
    if (signal) {
      console.log("   ✅ Signal tồn tại");
      console.log("    Sentiment:", signal.sentimentType);
      console.log("    Suggestion:", signal.suggestionType);
      console.log("    Confidence:", signal.confidence);
    } else {
      console.log("   ❌ Signal không tồn tại");
    }

    // Test 4: Mock Tweets
    console.log("\n Test 4: Mock Tweets");
    for (const mockTweet of mockTweets) {
      const tweet = await tweetTable.findOne({ url: mockTweet.url });
      if (tweet) {
        const preview = tweet.content.substring(0, 50);
        console.log(`   ✅ Tweet tồn tại: ${preview}...`);
        console.log(`   ✅ ${mockTweet.url}`);
      } else {
        console.log(`   ❌ Tweet không tồn tại: ${mockTweet.url}`);
      }
    }

    // Test 5: User-Balance Relationship
    console.log("\n Test 5: User-Balance Relationship");
    if (user && user.balances) {
      console.log(`   ✅ User có ${user.balances.length} balances`);
      for (const balance of user.balances) {
        const price = await tokenPricesTable.findOne({
          tokenAddress: balance.tokenAddress,
        });
        if (price) {
          const value = parseFloat(balance.balance) * parseFloat(price.priceUsd);
          console.log(`    ${balance.tokenAddress}: ${balance.balance} tokens = $${value.toFixed(2)}`);
        } else {
          console.log(`   ⚠️  Không tìm thấy price cho ${balance.tokenAddress}`);
        }
      }
    } else {
      console.log("   ❌ User không có balances");
    }

    console.log("\n✅ Tất cả tests đã hoàn thành!");

    await disconnectFromDatabase();
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

testDataIntegrity();

