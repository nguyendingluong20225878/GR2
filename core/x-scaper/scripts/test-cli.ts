import "dotenv/config";
import { processXScraping } from "../src/process"; 


console.log("TEST CLI STARTED");

// Lấy tham số đầu vào (ví dụ: "binance")
const specificAccountId = process.argv[2];

async function runTest() {
    try {
        console.log("--- Kiểm tra Scraper ---");
        const options = specificAccountId ? { specificAccountId } : {};
        
        // Gọi hàm chính của workflow
        const result = await processXScraping(options);
        
        console.log("\n--- TEST RESULT ---");
        console.log(JSON.stringify(result, null, 2));
        
        if (!result.success) {
            process.exit(1);
        }
    } catch (error) {
        console.error("Lỗi trong khi chạy:", error);
        process.exit(1);
    }
}

runTest();