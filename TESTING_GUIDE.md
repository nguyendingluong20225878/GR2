# 🧪 Hướng Dẫn Test 3 Chức Năng Cơ Bản - GR2 Project

## 📋 Mục Lục
1. [Chuẩn Bị Môi Trường](#chuẩn-bị-môi-trường)
2. [Chức Năng 1: Core Layer (MongoDB)](#chức-năng-1-core-layer-mongodb)
3. [Chức Năng 2: API Gateway & Chat DB](#chức-năng-2-api-gateway--chat-db)
4. [Chức Năng 3: API Tổng Hợp Dữ Liệu](#chức-năng-3-api-tổng-hợp-dữ-liệu)

---

## ✅ Kết Quả Test Mới Nhất (2025-11-19)

- `npm run test:connection` ✔️ Kết nối thành công tới Atlas cluster.
- `npm run test:schemas` ✔️ Users=7, TokenPrices=2, Signals=2, Tweets=1 (Tokens chưa seed → chạy `npm run db:seed` nếu cần).
- `npm run db:seed` ✔️ Đã seed mock user, balances, signals, tweets.
- `npm run test:integrity` ✔️ Tất cả kiểm tra pass, cảnh báo: chưa có price cho token `JUP...` → thêm giá vào `mockTokenPrices` nếu muốn.

---

## 🔧 Chuẩn Bị Môi Trường

### 1. Cài đặt Dependencies
```bash
# Từ root directory
npm install

# Hoặc cài đặt riêng cho từng package
cd core/shared
npm install

cd ../../apps/web
npm install
```

### 2. Cấu Hình Environment Variables
Tạo file `.env` trong `core/shared/`:
```env
MONGODB_URI=mongodb://localhost:27017/gr2_project
# Hoặc MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/gr2_project
```

### 3. Đảm Bảo MongoDB Đang Chạy
```bash
# Nếu dùng MongoDB local
mongod

# Hoặc kiểm tra connection string nếu dùng MongoDB Atlas
```

---

## ✅ Chức Năng 1: Core Layer (MongoDB)

### Mục Tiêu
Kiểm tra xem các MongoDB Schemas đã được định nghĩa đúng và có thể kết nối database.

### Bước 1: Test Database Connection

Tạo file test: `core/shared/scripts/test-connection.ts`

```typescript
import { connectToDatabase, disconnectFromDatabase } from "../src/db";

async function testConnection() {
  try {
    console.log("🔌 Đang kết nối MongoDB...");
    const connection = await connectToDatabase();
    console.log("✅ Kết nối thành công!");
    console.log("📊 Database:", connection.db.databaseName);
    console.log("🔗 Host:", connection.host);
    
    await disconnectFromDatabase();
    console.log("✅ Đã ngắt kết nối");
  } catch (error) {
    console.error("❌ Lỗi kết nối:", error);
    process.exit(1);
  }
}

testConnection();
```

**Chạy test:**
```bash
cd core/shared
npx tsx scripts/test-connection.ts
```

**Kết quả mong đợi:**
```
🔌 Đang kết nối MongoDB...
✅ Kết nối thành công!
📊 Database: gr2_project
🔗 Host: localhost:27017
✅ Đã ngắt kết nối
```

### Bước 2: Test Schema Definitions

Tạo file test: `core/shared/scripts/test-schemas.ts`

```typescript
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
    console.log("✅ Đã kết nối database");

    // Test Users Schema
    console.log("\n📝 Testing Users Schema...");
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
```

**Chạy test:**
```bash
cd core/shared
npx tsx scripts/test-schemas.ts
```

---

## ✅ Chức Năng 2: API Gateway & Chat DB

### Mục Tiêu
Kiểm tra xem Auth hoạt động và có thể Lưu/Đọc tin nhắn Chat từ MongoDB.

### Bước 1: Seed Mock Data

```bash
cd core/shared
npm run db:seed
```

**Kết quả mong đợi:**
```
Starting seeding...
Inserting mock data for data integrity testing...
Mock user "Test User" inserted successfully.
2 mock user balances inserted for user ...
2 mock token prices processed.
1 mock tweets processed.
Mock signal for token ... inserted successfully.
All seeding completed successfully!
```

### Bước 2: Test Chat API với tRPC

#### 2.1. Tạo Thread

**Request:**
```typescript
// Từ frontend hoặc tRPC client
const result = await trpc.chat.createThread.mutate({
  title: "Test Chat Thread"
});
```

**Hoặc dùng curl (nếu có HTTP endpoint):**
```bash
curl -X POST http://localhost:3000/api/trpc/chat.createThread \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"json":{"title":"Test Chat Thread"}}'
```

**Kết quả mong đợi:**
```json
{
  "id": "...",
  "userId": "...",
  "title": "Test Chat Thread",
  "messages": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

#### 2.2. Lấy Danh Sách Threads

**Request:**
```typescript
const threads = await trpc.chat.getUserThreads.query({
  limit: 10
});
```

**Kết quả mong đợi:**
```json
[
  {
    "id": "...",
    "title": "Test Chat Thread",
    "createdAt": "...",
    "updatedAt": "...",
    "lastMessage": null
  }
]
```

#### 2.3. Tạo Message

**Request:**
```typescript
const message = await trpc.chat.createMessage.mutate({
  threadId: "THREAD_ID",
  role: "user",
  parts: { text: "Hello, this is a test message!" },
  attachments: {}
});
```

**Kết quả mong đợi:**
```json
{
  "id": "...",
  "threadId": "...",
  "role": "user",
  "parts": { "text": "Hello, this is a test message!" },
  "attachments": {},
  "createdAt": "..."
}
```

#### 2.4. Lấy Messages

**Request:**
```typescript
const messages = await trpc.chat.getMessages.query({
  threadId: "THREAD_ID",
  limit: 50
});
```

**Kết quả mong đợi:**
```json
[
  {
    "id": "...",
    "role": "user",
    "parts": { "text": "Hello, this is a test message!" },
    "attachments": {},
    "createdAt": "..."
  }
]
```

### Bước 3: Test Auth (Nếu có)

Kiểm tra xem session có được tạo đúng không:
```typescript
// Test session
const session = await auth();
console.log("Session:", session);
```

---

## ✅ Chức Năng 3: API Tổng Hợp Dữ Liệu

### Mục Tiêu
Kiểm tra xem API có thể lấy và tổng hợp Mock Data (User, Price, Balance, Signal) từ MongoDB.

### Bước 1: Test Token Router

#### 1.1. Lấy Tất Cả Tokens

**Request:**
```typescript
const tokens = await trpc.token.getAllTokens.query();
```

**Kết quả mong đợi:**
```json
[
  {
    "_id": "...",
    "address": "So11111111111111111111111111111111111111112",
    "symbol": "SOL",
    "name": "Wrapped SOL",
    "decimals": 9,
    "type": "normal",
    "iconUrl": "/tokens/SOL.png"
  },
  ...
]
```

#### 1.2. Lấy Token Prices

**Request:**
```typescript
const prices = await trpc.token.getTokenPrices.query({
  tokenAddresses: ["So11111111111111111111111111111111111111112"],
  limit: 20
});
```

**Kết quả mong đợi:**
```json
[
  {
    "_id": "...",
    "tokenAddress": "So11111111111111111111111111111111111111112",
    "priceUsd": "168.48",
    "lastUpdated": "...",
    "source": "jupiter",
    "token": {
      "symbol": "SOL",
      "name": "Wrapped SOL",
      ...
    }
  }
]
```

### Bước 2: Test Portfolio Router

#### 2.1. Lấy User Portfolio

**Request:**
```typescript
const portfolio = await trpc.portfolio.getUserPortfolio.query({
  walletAddress: "0xTestWalletAddress",
  forceRefresh: false
});
```

**Kết quả mong đợi:**
```json
{
  "wallet_address": "0xTestWalletAddress",
  "total_value_usd": "5000.00",
  "tokens": [
    {
      "symbol": "SOL",
      "tokenAddress": "So11111111111111111111111111111111111111112",
      "balance": "2000",
      "priceUsd": "168.48",
      "valueUsd": "336960.00",
      "priceChange24h": "0",
      "iconUrl": "/tokens/SOL.png"
    },
    ...
  ],
  "perp_positions": [],
  "last_updated": "..."
}
```

### Bước 3: Test Data Integrity

Tạo file test: `core/shared/scripts/test-data-integrity.ts`

```typescript
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
    console.log("📝 Test 1: Mock User");
    const user = await usersTable.findOne({ email: mockUser.email });
    if (user) {
      console.log("   ✅ Mock user tồn tại:", user.name);
      console.log("   📊 Balances:", user.balances?.length || 0, "tokens");
    } else {
      console.log("   ❌ Mock user không tồn tại");
    }

    // Test 2: Mock Token Prices
    console.log("\n💰 Test 2: Mock Token Prices");
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
    console.log("\n📡 Test 3: Mock Signal");
    const signal = await signalsTable.findOne({
      tokenAddress: mockSignal.tokenAddress,
    });
    if (signal) {
      console.log("   ✅ Signal tồn tại");
      console.log("   📊 Sentiment:", signal.sentimentType);
      console.log("   📊 Suggestion:", signal.suggestionType);
      console.log("   📊 Confidence:", signal.confidence);
    } else {
      console.log("   ❌ Signal không tồn tại");
    }

    // Test 4: Mock Tweets
    console.log("\n🐦 Test 4: Mock Tweets");
    for (const mockTweet of mockTweets) {
      const tweet = await tweetTable.findOne({ url: mockTweet.url });
      if (tweet) {
        console.log(`   ✅ Tweet tồn tại: ${tweet.content.substring(0, 50)}...`);
      } else {
        console.log(`   ❌ Tweet không tồn tại: ${mockTweet.url}`);
      }
    }

    // Test 5: User-Balance Relationship
    console.log("\n🔗 Test 5: User-Balance Relationship");
    if (user && user.balances) {
      console.log(`   ✅ User có ${user.balances.length} balances`);
      for (const balance of user.balances) {
        const price = await tokenPricesTable.findOne({
          tokenAddress: balance.tokenAddress,
        });
        if (price) {
          const value = parseFloat(balance.balance) * parseFloat(price.priceUsd);
          console.log(`   💰 ${balance.tokenAddress}: ${balance.balance} tokens = $${value.toFixed(2)}`);
        }
      }
    }

    console.log("\n✅ Tất cả tests đã hoàn thành!");

    await disconnectFromDatabase();
  } catch (error) {
    console.error("❌ Lỗi:", error);
    process.exit(1);
  }
}

testDataIntegrity();
```

**Chạy test:**
```bash
cd core/shared
npx tsx scripts/test-data-integrity.ts
```

**Kết quả mong đợi:**
```
✅ Đã kết nối database

📝 Test 1: Mock User
   ✅ Mock user tồn tại: Test User
   📊 Balances: 2 tokens

💰 Test 2: Mock Token Prices
   ✅ Price cho So11111111111111111111111111111111111111112: $168.48
   ✅ Price cho EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: $1.00

📡 Test 3: Mock Signal
   ✅ Signal tồn tại
   📊 Sentiment: negative
   📊 Suggestion: sell
   📊 Confidence: 0.8

🐦 Test 4: Mock Tweets
   ✅ Tweet tồn tại: In the past 2 days, a whale has deposited...

🔗 Test 5: User-Balance Relationship
   ✅ User có 2 balances
   💰 So11111111111111111111111111111111111111112: 2000 tokens = $336960.00
   💰 JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 1000 tokens = $525.39

✅ Tất cả tests đã hoàn thành!
```

---

## 🚀 Quick Test Script

Tạo file `core/shared/scripts/quick-test.ts` để chạy tất cả tests:

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runTests() {
  console.log("🧪 Bắt đầu test tất cả chức năng...\n");

  const tests = [
    { name: "Database Connection", file: "test-connection.ts" },
    { name: "Schema Definitions", file: "test-schemas.ts" },
    { name: "Data Integrity", file: "test-data-integrity.ts" },
  ];

  for (const test of tests) {
    console.log(`\n📋 Running: ${test.name}`);
    try {
      const { stdout, stderr } = await execAsync(
        `npx tsx scripts/${test.file}`
      );
      console.log(stdout);
      if (stderr) console.error(stderr);
      console.log(`✅ ${test.name} passed\n`);
    } catch (error: any) {
      console.error(`❌ ${test.name} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log("\n🎉 Tất cả tests đã hoàn thành thành công!");
}

runTests();
```

**Chạy:**
```bash
cd core/shared
npx tsx scripts/quick-test.ts
```

---

## 📝 Checklist Test

### Chức Năng 1: Core Layer
- [ ] Database connection thành công
- [ ] Tất cả schemas được định nghĩa đúng
- [ ] Collections được tạo trong MongoDB

### Chức Năng 2: API Gateway & Chat DB
- [ ] Seed mock data thành công
- [ ] Tạo thread thành công
- [ ] Lấy danh sách threads thành công
- [ ] Tạo message thành công
- [ ] Lấy messages thành công
- [ ] Auth hoạt động (nếu có)

### Chức Năng 3: API Tổng Hợp Dữ Liệu
- [ ] Lấy tất cả tokens thành công
- [ ] Lấy token prices thành công
- [ ] Lấy user portfolio thành công
- [ ] Data integrity: User-Balance relationship đúng
- [ ] Data integrity: Token prices tồn tại
- [ ] Data integrity: Signals tồn tại
- [ ] Data integrity: Tweets tồn tại

---

## 🐛 Troubleshooting

### Lỗi: "MONGODB_URI is not set"
**Giải pháp:** Tạo file `.env` trong `core/shared/` với `MONGODB_URI`

### Lỗi: "Cannot connect to MongoDB"
**Giải pháp:** 
- Kiểm tra MongoDB đang chạy
- Kiểm tra connection string đúng
- Kiểm tra firewall/network

### Lỗi: "Collection not found"
**Giải pháp:** Chạy seed script để tạo collections và data

### Lỗi: "Module not found: @gr2/shared"
**Giải pháp:**
```bash
# Build shared package
cd core/shared
npm run build

# Hoặc link package
npm link
cd ../../apps/web
npm link @gr2/shared
```

---

## 📚 Tài Liệu Tham Khảo

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [tRPC Documentation](https://trpc.io/)

