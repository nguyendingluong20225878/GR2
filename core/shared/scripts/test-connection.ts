import { connectToDatabase, disconnectFromDatabase } from "../src/db";

async function testConnection() {
  try {
    console.log("🔌 Đang kết nối MongoDB...");
    const connection = await connectToDatabase();
    console.log("✅ Kết nối thành công!");
    console.log("📊 Database:", connection.db.databaseName);
    console.log("🔗 Host:", connection.host);
    console.log("🔗 Port:", connection.port);
    
    await disconnectFromDatabase();
    console.log("✅ Đã ngắt kết nối");
  } catch (error) {
    console.error("❌ Lỗi kết nối:", error);
    process.exit(1);
  }
}

testConnection();

