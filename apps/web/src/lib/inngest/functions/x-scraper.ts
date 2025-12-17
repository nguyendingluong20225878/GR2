// apps/web/src/lib/inngest/functions/x-scraper.ts

import { inngest } from "../client"; 
import { processXScraping } from "packages/x-scraper/src/process"; // Import hàm điều phối
import { Logger } from "@daiko-ai/shared"; 

const logger = new Logger("InngestScraper");

// Định nghĩa sự kiện kích hoạt Signal Detection sau khi Scrape
export const X_SCRAPING_COMPLETED_EVENT = "x/scraping.completed";

export const scheduledXScraper = inngest.createFunction(
  { id: "scheduled-x-scraper-run", name: "Scheduled X Scraper Run" },
  // ⏱️ Lên lịch chạy mỗi 15 phút
  { cron: "*/15 * * * *" }, 
  async ({ step }) => {
    // 1. Chạy quá trình scraping
    logger.info("Executing scheduled X scraping workflow.");
    
    const result = await step.run(
      "run-all-x-scrapers",
      async () => {
        // Gọi hàm điều phối chính
        return processXScraping();
      }
    );

    // 2. Kích hoạt Signal Detection nếu quá trình Scrape thành công
    if (result.success) {
      // Giả định rằng nếu thành công thì có dữ liệu mới (hoặc cần chạy Signal Detector)
      logger.info("X Scraping finished successfully. Triggering Signal Detection.");
      
      await step.sendEvent("trigger-signal-detection", {
        name: X_SCRAPING_COMPLETED_EVENT,
        data: { 
          message: result.message,
        },
      });
    } else {
        logger.error("X Scraping failed. Not triggering Signal Detection.");
    }

    return result;
  }
);