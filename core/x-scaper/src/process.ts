// packages/x-scraper/src/process.ts

import { XScraper } from "./scraper";
// Cần đảm bảo các biến môi trường sau được thiết lập trong file .env
const X_EMAIL = process.env.X_SCRAPER_EMAIL || process.env.X_EMAIL;
const X_PASSWORD = process.env.X_SCRAPER_PASSWORD || process.env.X_PASSWORD;
const X_USERNAME = process.env.X_SCRAPER_USERNAME || process.env.X_USERNAME;


/**
 * X（Twitter）
 * Đây là hàm entry point được gọi bởi Inngest/Cron Job.
 */
export async function processXScraping(options?: { specificAccountId?: string }): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  const startTime = new Date();

  // Kiểm tra credentials
  if (!X_EMAIL || !X_PASSWORD || !X_USERNAME) {
      const msg = "X SCRAPER: Missing environment variables (X_EMAIL, X_PASSWORD, X_USERNAME).";
      console.error(msg);
      return { success: false, message: msg };
  }

  try {
    console.log(`[${startTime.toISOString()}] Starting X scraping process.`);

    // 1. Khởi tạo Scraper với Credentials
    const credentials = {
      email: X_EMAIL,
      password: X_PASSWORD,
      username: X_USERNAME,
    };
    
    const scraper = new XScraper(credentials);

    // 2. Xử lý Scrape theo yêu cầu
    if (options?.specificAccountId) {
      console.log(`Scraping specific account: ${options.specificAccountId}`);

      try {
        const result = await scraper.checkSingleAccount(options.specificAccountId); 
        const message = result 
            ? `Scraping for ${options.specificAccountId} completed. New tweets found.` 
            : `Scraping for ${options.specificAccountId} completed. No new tweets.`;

        return {
          success: true,
          message: message,
          data: { accountId: options.specificAccountId, latestTimestamp: result },
        };
      } catch (error) {
         return {
          success: false,
          message: `Scraping failed for ${options.specificAccountId}: ${String(error)}`,
          data: { error: String(error) },
         };
      }
    }

    // Trường hợp quét TẤT CẢ các tài khoản
    console.log(`Starting batch scraping for all registered X accounts.`);
    
    // checkXAccounts sẽ tự quản lý driver lifecycle cho từng tài khoản.
    const { processed, success } = await scraper.checkXAccounts();

    return {
      success: true,
      message: `Batch scraping completed. Processed ${processed} accounts, found new tweets in ${success} accounts.`,
      data: { processed, success }
    };
  } catch (error) {
    console.error("X scraping process encountered a critical error:", error);
    return {
      success: false,
      message: `Critical failure in X scraping process: ${String(error)}`,
      data: { error: String(error) },
    };
  }
}