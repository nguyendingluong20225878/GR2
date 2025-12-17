// apps/web/src/app/api/inngest/route.ts

import { serve } from "inngest/next";
import { inngest } from "../../../lib/inngest/client";
import { scheduledXScraper } from "../../../lib/inngest/functions/x-scraper";
// Import các function khác sau này (ví dụ: Signal Detector workflow)

// Export hàm GET và POST cho Next.js App Router
export const { GET, POST } = serve({
  client: inngest,
  functions: [
    scheduledXScraper,
    // Thêm các function tiếp theo (Bước 4, 5) vào đây
  ],
});