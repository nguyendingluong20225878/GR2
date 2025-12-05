import fs from "fs";
import path from "path";
import { Logger, LogLevel, XAccountSelect, Tweet as CoreTweet } from "../../shared/src"
import { Builder, By, Key, until, WebDriver, WebElement, IWebDriverOptionsCookie as SeleniumCookie } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import { getAllXAccounts, saveTweets } from "./db";
import { randomDelay } from "./utils";

// Import đầy đủ các hằng số từ constant.ts
import {
  LOGIN_URL,
  X_BASE_URL,
  INITIAL_INPUT_SELECTOR_CSS,
  PASSWORD_SELECTOR_CSS, // Đã sửa từ PASSWORD_INPUT_SELECTOR_CSS
  TWEET_ARTICLE_SELECTOR_CSS,
  TIME_SELECTOR_CSS,
  DEFAULT_SELENIUM_SCRIPT_TIMEOUT,
  ELEMENT_LOCATE_TIMEOUT_MS,
  PAGE_LOAD_WAIT_MS,
  REPLY_COUNT_SELECTOR_CSS,
  RETWEET_COUNT_SELECTOR_CSS, // Đã thêm
  LIKE_COUNT_SELECTOR_CSS, // Đã thêm
  TWEET_TEXT_SELECTOR_CSS, // Đã thêm
  PRIMARY_COLUMN_SELECTOR_CSS,
  SHORT_DELAY_MIN,
  SHORT_DELAY_MAX,
  MEDIUM_DELAY_MIN,
  MEDIUM_DELAY_MAX,
  LONG_DELAY_MIN,
  LONG_DELAY_MAX,
  NEXT_BUTTON_XPATH, // Đã thêm XPath cho nút Next
  USERNAME_VERIFICATION_SELECTOR_CSS, // Đã thêm selector cho bước xác minh username
  COOKIES_DIR_RELATIVE, // Đã thêm
  COOKIES_FILENAME, // Đã thêm
  SCREENSHOTS_DIR_RELATIVE, // Đã thêm
} from "./constant"; // Cần đảm bảo file constant.ts đã được cập nhật đầy đủ

interface Credentials {
  email: string;
  password: string; 
  username: string;
}

interface Tweet {
  time: string; // ISO string
  data: string;
  url: string;
  replyCount: number | null;
  retweetCount: number | null;
  likeCount: number | null;
  impressionsCount: number | null;
}

function parseEngagementCount(text: string | null): number | null {
  if (!text) return null;

  const clean = text.replace(/,/g, "").toUpperCase(); // loai bo dau phay
  const num = parseFloat(clean);
  if (isNaN(num)) return null;

  //xu li chu cai viet hoa K(nghin) M(trieu)
  if (clean.includes("K")) return Math.round(num * 1000);
  if (clean.includes("M")) return Math.round(num * 1000000);

  return num;
}

export class XScraper {
  private driver: WebDriver | null = null;
  private credentials: Credentials;

  constructor(credentials: Credentials) { // ham khoi tao
    this.credentials = credentials;
  }

  // cookies la du lieu nho luu trong trinh duyet
  private getCookiesFilePath(): string {
    // Cải tiến: Sử dụng hằng số và tạo thư mục
    const dir = path.resolve(process.cwd(), COOKIES_DIR_RELATIVE);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, COOKIES_FILENAME);
  }

  private loadCookies(): any[] | null { // any[] : mang cookies
    const filePath = this.getCookiesFilePath();
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, "utf-8"); // doc file dang text
      return JSON.parse(raw); // chuyen json->obj
    } catch (e) {
      console.error("Failed to load cookies:", e);
      return null;
    }
  }

  private saveCookies(cookies: any[]): void {
    const filePath = this.getCookiesFilePath();
    try {
      fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2)); // null, 2 → format đẹp, có thụt lề 2 spaces
    } catch (e) {
      console.error("Failed to save cookies:", e);
    }
  }

  // Kiem tra cookies het han chua ?
  private areCookiesExpired(cookies: any[]): boolean {
    // Cải tiến: Kiểm tra dựa trên trường expiry trong cookie nếu có, nếu không thì dùng logic cũ (24h)
    const now = Date.now();
    const expiredByAge = (Date.now() - fs.statSync(this.getCookiesFilePath()).mtimeMs) / (1000 * 60 * 60) > 24;
    if (expiredByAge) return true;

    return cookies.some((c) => typeof c.expiry === "number" && c.expiry * 1000 < now);
  }

  private async initDriver(cookiesToInject?: any[]): Promise<void> {
    const options = new chrome.Options();
    options.addArguments("--headless=new"); // Chạy trình duyệt ở chế độ headless
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--user-agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'"); // Thêm user-agent để giảm khả năng bị chặn

    // dieu chinh neu chay tren linux arm64
    if (process.platform === "linux" && process.arch === "arm64") {
      options.setChromeBinaryPath("/usr/bin/chromium-browser");
    }

    this.driver = await new Builder() // tao Selenium WebDriver
      .forBrowser("chrome") // chon chrome
      .setChromeOptions(options) // ap dung cac option da dinh nghia
      .build(); // khoi tao
    
    // Thiết lập timeout mặc định
    await this.driver.manage().setTimeouts({ script: DEFAULT_SELENIUM_SCRIPT_TIMEOUT });

    // Script chống phát hiện bot
    await this.driver.executeScript(`
      if (navigator.webdriver === true) {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true
        });
      }
    `);


    if (cookiesToInject && cookiesToInject.length > 0) {
      await this.driver.get(X_BASE_URL);
      for (const cookie of cookiesToInject) {
        try {
          // Thêm kiểm tra domain, name, value trước khi addCookie
          if (cookie.name && cookie.value && cookie.domain) {
            // Ép kiểu thành SeleniumCookie nếu cần (tùy thuộc vào phiên bản Selenium)
            await this.driver.manage().addCookie(cookie as SeleniumCookie);
          }
        } catch (err) {
          console.warn("Cookie inject failed:", cookie.name);
        }
      }
    }
  }

  public async closeDriver(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null; // reset
    }
  }

  //Chup man hinh khi that bai
  private async captureFailureScreenshot(name: string): Promise<void> {
    if (!this.driver) return;
    try {
      const image = await this.driver.takeScreenshot(); // takeScreenshot : WebDriver API
      // Cải tiến: Sử dụng hằng số và tạo thư mục
      const dir = path.resolve(process.cwd(), SCREENSHOTS_DIR_RELATIVE);
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, `${name}_failure_${Date.now()}.png`);
      fs.writeFileSync(filePath, image, "base64");
      console.log(`Screenshot saved to ${filePath}`);
    } catch (e) {
      console.error(`Failed to capture ${name} screenshot:`, e);
    }
  }

  private async login(): Promise<void> {
    if (!this.driver) throw new Error("WebDriver not initialized");
    if (!this.credentials) throw new Error("Credentials not set");

    try {
      console.log("Logging in ...");
      await this.driver.get(LOGIN_URL);

      // 1. Email/Username Input
      await this.driver.wait(until.elementLocated(By.css(INITIAL_INPUT_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS); // cho element email xuat hien
      const emailInput = await this.driver.findElement(By.css(INITIAL_INPUT_SELECTOR_CSS)); // Lay input email
      await emailInput.sendKeys(this.credentials.email); // dien email tu this.credentials.email

      // Click Next (Sử dụng XPath từ hằng số)
      await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
      const nextButton = await this.driver.findElement(By.xpath(NEXT_BUTTON_XPATH)); 
      await nextButton.click();
      await this.driver.sleep(randomDelay(MEDIUM_DELAY_MIN, MEDIUM_DELAY_MAX));

      // 2. Handle Username (Verification) OR Password
      const passwordSelector = By.css(PASSWORD_SELECTOR_CSS);
      const usernameVerificationSelector = By.css(USERNAME_VERIFICATION_SELECTOR_CSS);
      
      // Chờ chuyển trang và kiểm tra xem là bước Password hay Username
      try {
        await this.driver.wait(until.elementLocated(By.css(PASSWORD_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS / 2);
      } catch {
        // Nếu không tìm thấy Password ngay lập tức, thử tìm Username Verification
        try {
          const usernameInput = await this.driver.findElement(usernameVerificationSelector);
          console.log("Username verification step detected.");
          await usernameInput.sendKeys(this.credentials.username);
          await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));

          const nextButtonStep2 = await this.driver.findElement(By.xpath(NEXT_BUTTON_XPATH));
          await nextButtonStep2.click();
          await this.driver.wait(until.elementLocated(passwordSelector), ELEMENT_LOCATE_TIMEOUT_MS * 2); // Chờ password sau khi submit username
        } catch (e) {
          console.error("Failed to handle username verification.");
          throw e;
        }
      }
      
      // 3. Password Input
      const passwordInput = await this.driver.findElement(passwordSelector);
      await passwordInput.sendKeys(this.credentials.password);

      await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
      
      // Submit (Key.ENTER)
      await passwordInput.sendKeys(Key.ENTER);
      await this.driver.sleep(randomDelay(LONG_DELAY_MIN, LONG_DELAY_MAX));


      // 4. Xac nhan login
      await this.driver.wait(
        until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), // Đợi cột chính
        ELEMENT_LOCATE_TIMEOUT_MS * 3
      );
      console.log("Login successful!");

      // 5. save cookies
      const cookies = await this.driver.manage().getCookies();
      this.saveCookies(cookies);
    } catch (error) {
      console.error("Login failed:", error);
      await this.captureFailureScreenshot("login_fail");
      throw error;
    }
  }

  public async ensureLoggedIn(): Promise<boolean> {
    const cookies = this.loadCookies();
    const expired = this.areCookiesExpired(cookies || []);

    if (cookies && !expired) {
      console.log("♻️ Reusing saved cookies...");
      await this.initDriver(cookies);

      try {
        await this.driver!.get(X_BASE_URL + "/home");
        // Chờ một element chỉ ra trạng thái đã đăng nhập
        await this.driver!.wait(
          until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)),
          ELEMENT_LOCATE_TIMEOUT_MS
        );
        console.log("✅ Session restored from cookies");
        return true;
      } catch (e) {
        console.warn("⚠️ Cookies invalid, relogin required", e);
        await this.closeDriver();
        // Tiếp tục xuống login mới
      }
    }

    // Nếu không có cookies hoặc hết hạn → login mới
    try {
      if (!this.driver) await this.initDriver();
      await this.login();
      return true;
    } catch (e) {
      console.error("Final login attempt failed.", e);
      return false;
    }
  }

  
  // ========================= PHẦN LẤY URL VÀ TRÍCH XUẤT ========================= //

  // Ham lay tweet(bam vao tweet-> cho chuyen sang status-> lay url -> back)
  private async getTweetUrlViaNavigation(
    driver: WebDriver,
    tweetElement: WebElement // the article cho 1 tweet
  ): Promise<string> {
    let url = "";
    const originalPageUrl = await driver.getCurrentUrl(); // url hien tai
    console.log(`[getTweetUrl] Navigating from ${originalPageUrl} to get tweet URL.`);

    try {
      const timeElem = await tweetElement.findElement(By.css(TIME_SELECTOR_CSS));
      await driver.executeScript("arguments[0].click();", timeElem); // click bang js de on dinh hon

      await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return currentUrl !== originalPageUrl && /\/status\//.test(currentUrl); // url phai chua status
      }, ELEMENT_LOCATE_TIMEOUT_MS + 5000);

      url = await driver.getCurrentUrl(); // lay url sau khi chuyen trang
      console.log(`[getTweetUrl] Retrieved tweet URL: ${url}`);
    } catch (error) {
      console.error("[getTweetUrl] Failed to retrieve tweet URL via navigation:", error);
      await this.captureFailureScreenshot("getTweetUrlError");
      // that bai thi url van la ""
    } finally {//lay url hien tai sau khi try xong
      const urlAfterNavigationAttempt = await driver.getCurrentUrl().catch(() => "");

      // dieu huong qua lai trang goc
      if (urlAfterNavigationAttempt !== originalPageUrl) {
        console.log(`[getTweetUrl] Navigating back to original page: ${originalPageUrl}`);
        try {
          await driver.navigate().back(); // quay lai
          // cho trang goc load xong
          await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS); // doi tweet load
          await driver.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS); // doi cot chinh load
          console.log("[getTweetUrl] Successfully navigated back to original page.");
        } catch (navBackError) {
          console.warn("[getTweetUrl] Navigation back to original page failed:", navBackError);
          await this.captureFailureScreenshot("navigationBackError");

          // dieu huong cung ve trang chu
          try {
            await driver.get(X_BASE_URL + "/home"); // ve thang home de reset trang thai
            await driver.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS);
            console.log("[getTweetUrl] Recovered by navigating to home page.");
          } catch (recoveryError) {
            console.error("[getTweetUrl] Recovery navigation to home page failed:", recoveryError);
            await this.captureFailureScreenshot("recoveryNavigationError");
          }
        }
      } else {
        console.log("[getTweetUrl] No back navigation performed.");
      }
    }

    return url;
  }

  // ========================= TRICH XUAT TWEET (Đã thêm logic cuộn) ========================= //

  public async extractTweets(driver: WebDriver): Promise<Tweet[]> {
    const MAX_TWEETS_TO_PROCESS_PER_ACCOUNT = 50; // Giới hạn tạm thời 50 (Cần import từ constant.ts nếu đã có)
    const tweets: Tweet[] = []; // danh sach tweet
    let currentTweetIndexOnPage = 0; // index tweet dang xu li
    const processedTweetIdentifiers = new Set<string>(); // luu datatime cua tweet de tranh lap
    let consecutiveScrollsWithoutNewContent = 0;
    const MAX_CONSECUTIVE_SCROLLS_WITHOUT_NEW_CONTENT = 3; // Cuộn tối đa 3 lần mà không thấy nội dung mới

    // vong lap chinh
    for (let attempt = 0; tweets.length < MAX_TWEETS_TO_PROCESS_PER_ACCOUNT && attempt < 150; attempt++) {
        
      // 1. Tải lại danh sách bài viết
      await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS);
      let articles = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));
      let articlesOnPageCount = articles.length;

      // 2. Logic Tự động Cuộn (Nếu đã xử lý hết các tweet hiện có)
      if (currentTweetIndexOnPage >= articlesOnPageCount) {
        if (consecutiveScrollsWithoutNewContent >= MAX_CONSECUTIVE_SCROLLS_WITHOUT_NEW_CONTENT) {
          console.log("[extractTweets] Max consecutive scrolls without new content reached. Stopping.");
          break; // Thoát vòng lặp chính
        }
        
        console.log(`[extractTweets] Reached end of visible tweets. Attempting to scroll (attempt ${consecutiveScrollsWithoutNewContent + 1}).`);
        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
        await driver.sleep(randomDelay(MEDIUM_DELAY_MIN + 1000, MEDIUM_DELAY_MAX + 2000)); // Delay sau khi cuộn

        const articlesAfterScroll = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));
        if (articlesAfterScroll.length > articlesOnPageCount) {
          console.log(`[extractTweets] Scrolled and loaded ${articlesAfterScroll.length - articlesOnPageCount} new articles.`);
          articles = articlesAfterScroll;
          articlesOnPageCount = articles.length;
          consecutiveScrollsWithoutNewContent = 0; // Reset counter
        } else {
          console.log("[extractTweets] Scroll did not load new articles. Incrementing no-new-content scroll counter.");
          consecutiveScrollsWithoutNewContent++;
        }
        
        if (currentTweetIndexOnPage >= articlesOnPageCount) {
          console.log(`[extractTweets] Still no more articles to process at index ${currentTweetIndexOnPage} after scroll.`);
          continue; // Quay lại đầu vòng lặp để kiểm tra điều kiện thoát/cuộn lại
        }
      }
      
      const el = articles[currentTweetIndexOnPage];

      // Nếu element không tồn tại sau khi cuộn/tải lại (không nên xảy ra nếu articlesOnPageCount > currentTweetIndexOnPage)
      if (!el) break; 

      let tweetTime = ""; // tgian post
      let tweetMomentIdentifier = `no_time_idx_${currentTweetIndexOnPage}_${Date.now()}`; // dinh danh tweet neu khong co time

      try {
        const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));
        tweetTime = await timeElem.getAttribute("datetime"); // lay thuoc tinh datetime
        if (tweetTime) tweetMomentIdentifier = tweetTime;
      } catch {}

      if (processedTweetIdentifiers.has(tweetMomentIdentifier)) {
        currentTweetIndexOnPage++;
        attempt--; // Không tính là một lần xử lý tweet
        continue;
      }

      // trich xuat du lieu tweet
      let tweetText = "";
      // Cần sử dụng TWEET_TEXT_SELECTOR_CSS đã fix trong constant.ts
      const textNodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS)); 
      if (textNodes.length > 0) {
        for (const node of textNodes) {
          tweetText += `${await node.getText()} `; // Thêm dấu cách để các đoạn text không dính vào nhau
        }
      }
      tweetText = tweetText.trim();
 
      //bo qua tweet khong co thoi gian hoac text
      if (!tweetTime || tweetText.length === 0) {
        processedTweetIdentifiers.add(tweetMomentIdentifier);
        currentTweetIndexOnPage++;
        continue;
      }

      // trich xuat chi so tuong tac
      let replyCount: number | null = null;
      let retweetCount: number | null = null;
      let likeCount: number | null = null;

      try {
        // Sử dụng REPLY_COUNT_SELECTOR_CSS đã fix
        const replyButton = await el.findElement(By.css(REPLY_COUNT_SELECTOR_CSS)); 
        replyCount = parseEngagementCount(await replyButton.getText());
      } catch {}

      try {
        // Sử dụng RETWEET_COUNT_SELECTOR_CSS đã fix
        const retweetButton = await el.findElement(By.css(RETWEET_COUNT_SELECTOR_CSS)); 
        retweetCount = parseEngagementCount(await retweetButton.getText());
      } catch {}

      try {
        // Sử dụng LIKE_COUNT_SELECTOR_CSS đã fix
        const likeButton = await el.findElement(By.css(LIKE_COUNT_SELECTOR_CSS)); 
        likeCount = parseEngagementCount(await likeButton.getText());
      } catch {}

      // lay url
      const tweetUrl = await this.getTweetUrlViaNavigation(driver, el);

      //Luu ket qua
      if (tweetUrl) {
        tweets.push({
          time: tweetTime,
          data: tweetText,
          url: tweetUrl,
          replyCount,
          retweetCount,
          likeCount,
          impressionsCount: null,
        });

        processedTweetIdentifiers.add(tweetMomentIdentifier);
      } else {
        // Nếu URL không lấy được, vẫn đánh dấu là đã xử lý để không lặp lại
        processedTweetIdentifiers.add(tweetMomentIdentifier);
      }

      currentTweetIndexOnPage++;//chuyen sang tweet tiep theo
    }

    console.log(`[extractTweets] Extraction complete. Total tweets collected: ${tweets.length}`);

    // sap xep giam dan theo thoi gian
    return tweets.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }

  
  // ========================= HAM NGHIEP VU CHINH (ĐÃ TÍCH HỢP LOGIC DB) ========================= //

  // Đổi tên hàm để phản ánh logic nghiệp vụ (Kiểm tra và lưu)
  public async checkSingleAccount(xId: string): Promise<Date | null> {
    
    // 1. Đảm bảo đăng nhập
    const isLoggedIn = await this.ensureLoggedIn();

    if (!isLoggedIn || !this.driver) {
      console.error("Driver not available after ensureLoggedIn.");
      return null;
    }

    try {
      console.log(`Navigating to account: ${xId}`);
      await this.driver!.get(`${X_BASE_URL}/${xId}`);
      await this.driver!.wait(
        until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)),
        ELEMENT_LOCATE_TIMEOUT_MS
      );
      
      // 2. Trích xuất tất cả tweets có thể
      const extractedTweets = await this.extractTweets(this.driver!);

      if (extractedTweets.length === 0) {
        console.warn(`No tweets found for ${xId}`);
        return null;
      }

      // 3. Lấy thông tin tài khoản từ DB
      const accounts = await getAllXAccounts();
      const account = accounts.find((acc) => acc.id === xId);

      if (!account) {
        console.error(`Account ${xId} not found in database`);
        return null;
      }

      // 4. Lọc tweets mới hơn lastTweetUpdatedAt
      const newTweets = extractedTweets.filter((tweet) => {
        const tweetDate = new Date(tweet.time);
        // lastTweetUpdatedAt có thể là null nếu chưa từng scrape
        return !account.lastTweetUpdatedAt || tweetDate > new Date(account.lastTweetUpdatedAt);
      });

      if (newTweets.length === 0) {
        console.log(`No new tweets found for ${xId} since last check.`);
        return null;
      }

      console.log(`Found ${newTweets.length} new tweets for ${xId}. Saving to DB.`);

      // 5. Lưu tweets mới và cập nhật timestamp
      const latestTweetTimestampProcessed = await saveTweets(xId, newTweets);

      return latestTweetTimestampProcessed;

    } catch (error) {
      console.error(`Error in checkSingleAccount for ${xId}:`, error);
      await this.captureFailureScreenshot(`checkSingleAccount_error_${xId}`);
      return null;
    } finally {
      await this.closeDriver();
    }
  }

  // Tương đương với hàm runScraping cũ, nhưng đã được đổi tên để tích hợp logic DB.
  public async runScraping(xId: string): Promise<Tweet[]> {
    const timestamp = await this.checkSingleAccount(xId);
    // Hàm này được giữ lại để phù hợp với interface cũ nếu cần, nhưng logic cốt lõi nằm ở checkSingleAccount.
    // Vì checkSingleAccount đã đóng driver, nếu muốn lấy lại list Tweets, bạn sẽ cần query DB.
    console.warn("runScraping is deprecated. Use checkSingleAccount for full lifecycle. Returning dummy list.");
    return []; 
  }
}