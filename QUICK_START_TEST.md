# 🚀 Quick Start - Test 3 Chức Năng Cơ Bản

## ⚡ Bắt Đầu Nhanh

### Bước 1: Cài Đặt Dependencies
```bash
# Từ root directory
npm install

# Hoặc chỉ cài cho shared package
cd core/shared
npm install
```

### Bước 2: Cấu Hình MongoDB
Tạo file `.env` trong `core/shared/`:
```env
MONGODB_URI=mongodb://localhost:27017/gr2_project
```

### Bước 3: Chạy Tests

#### Test Chức Năng 1: Core Layer
```bash
cd core/shared

# Test database connection
npm run test:connection

# Test schemas
npm run test:schemas
```

#### Test Chức Năng 2: Seed Mock Data
```bash
cd core/shared

# Seed mock data vào MongoDB
npm run db:seed
```

#### Test Chức Năng 3: Data Integrity
```bash
cd core/shared

# Test data integrity
npm run test:integrity
```

#### Chạy Tất Cả Tests
```bash
cd core/shared

# Chạy tất cả tests
npm run test:all
```

---

## 📋 Checklist Test Nhanh

### ✅ Chức Năng 1: Core Layer
```bash
npm run test:connection  # ✅ Kết nối MongoDB thành công
npm run test:schemas      # ✅ Tất cả schemas được định nghĩa
```

### ✅ Chức Năng 2: API Gateway & Chat DB
```bash
npm run db:seed           # ✅ Seed mock data thành công
# Sau đó test Chat API qua tRPC (xem TESTING_GUIDE.md)
```

### ✅ Chức Năng 3: API Tổng Hợp Dữ Liệu
```bash
npm run test:integrity    # ✅ Data integrity test thành công
# Sau đó test Token & Portfolio API qua tRPC (xem TESTING_GUIDE.md)
```

---

## 🎯 Kết Quả Mong Đợi

### Test Connection
```
🔌 Đang kết nối MongoDB...
✅ Kết nối thành công!
📊 Database: gr2_project
🔗 Host: localhost
✅ Đã ngắt kết nối
```

### Test Schemas
```
✅ Đã kết nối database

📝 Testing Users Schema...
   Users collection: X documents

🪙 Testing Tokens Schema...
   Tokens collection: X documents

💰 Testing Token Prices Schema...
   Token Prices collection: X documents

💬 Testing Chat Threads Schema...
   Chat Threads collection: X documents

📡 Testing Signals Schema...
   Signals collection: X documents

🐦 Testing Tweets Schema...
   Tweets collection: X documents

✅ Tất cả schemas đã được định nghĩa đúng!
```

### Test Data Integrity
```
✅ Đã kết nối database

📝 Test 1: Mock User
   ✅ Mock user tồn tại: Test User
   📊 Balances: 2 tokens

💰 Test 2: Mock Token Prices
   ✅ Price cho ...: $168.48
   ✅ Price cho ...: $1.00

📡 Test 3: Mock Signal
   ✅ Signal tồn tại
   📊 Sentiment: negative
   📊 Suggestion: sell

🐦 Test 4: Mock Tweets
   ✅ Tweet tồn tại: ...

🔗 Test 5: User-Balance Relationship
   ✅ User có 2 balances
   💰 ...: 2000 tokens = $336960.00

✅ Tất cả tests đã hoàn thành!
```

---

## 🐛 Troubleshooting

### Lỗi: "tsx: command not found"
```bash
cd core/shared
npm install tsx --save-dev
```

### Lỗi: "MONGODB_URI is not set"
Tạo file `.env` trong `core/shared/` với nội dung:
```env
MONGODB_URI=mongodb://localhost:27017/gr2_project
```

### Lỗi: "Cannot connect to MongoDB"
- Kiểm tra MongoDB đang chạy: `mongod`
- Hoặc sử dụng MongoDB Atlas connection string

---

## 📚 Xem Chi Tiết

Xem file `TESTING_GUIDE.md` để có hướng dẫn chi tiết hơn về:
- Test API endpoints
- Test Chat functionality
- Test Portfolio aggregation
- Troubleshooting chi tiết

