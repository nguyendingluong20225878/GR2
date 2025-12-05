import fs from "fs";
import path from "path";
import { Builder, By, until, WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import { WebElement } from "selenium-webdriver";

import {
  LOGIN_URL,
  X_BASE_URL,
  INITIAL_INPUT_SELECTOR_CSS,
  PASSWORD_INPUT_SELECTOR_CSS,
  TWEET_ARTICLE_SELECTOR_CSS,
  TIME_SELECTOR_CSS,
  DEFAULT_SELENIUM_SCRIPT_TIMEOUT,
  ELEMENT_LOCATE_TIMEOUT_MS,
  PAGE_LOAD_WAIT_MS,
  REPLY_COUNT_SELECTOR_CSS,
  RETWEET_COUNT_SELECTOR_CSS,
  LIKE_COUNT_SELECTOR_CSS,
  TWEET_TEXT_SELECTOR_CSS,
  PRIMARY_COLUMN_SELECTOR_CSS,
  SHORT_DELAY_MIN,
  SHORT_DELAY_MAX,
  MEDIUM_DELAY_MIN,
  MEDIUM_DELAY_MAX,
  LONG_DELAY_MIN,
  LONG_DELAY_MAX,
} from "./constant";

interface Credentials {
  email: string;
  password: string;
  username: string;
}

interface Tweet {
    time : string; // ISO string
    data : string;
    url : string;
    replyCount : number | null;
    retweetCount : number | null;
    likeCount : number | null;
    impressionsCount: number | null;
}

function randomDelay (min: number , max: number) : number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function parseEngagementCount(text: string | null): number | null {
    if(!text) return null;
    const num = parseFloat(text.replace(/,/g, '')); // loai bo dau phay
    return isNaN(num) ? null : num; 

    //xu li chu cai viet hoa K(nghin) M(trieu)
    if(text?.toUpperCase().includes('K')) {
        return Math.round(num * 1000);

    }
    if(text?.toUpperCase().includes('M')) {
        return Math.round(num * 1000000);
    } 
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
    // create and return path to cookies.json file
    return path.join(__dirname, 'cookies.json');
  }

  private loadCookies(): any[] | null { // any[] : mang cookies
    const filePath = this.getCookiesFilePath();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8'); // doc file dang text
    return JSON.parse(raw); // chuyen json->obj
  }

  private saveCookies(cookies: any[]): void {
    const filePath = this.getCookiesFilePath();
    fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2)); // null, 2 → format đẹp, có thụt lề 2 spaces
  }

  // Kiem tra cookies het han chua ?
  private areCookiesExpired(cookies: any[]): boolean {
    const filePath = this.getCookiesFilePath();
    if (!fs.existsSync(filePath)) return true;
    const stats = fs.statSync(filePath);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
    return ageHours > 24; // cookies het han sau 24h
  }

  private async initDriver(cookiesToInject?: any[]): Promise<void> {
    const options = new chrome.Options();
    options.addArguments('--headless=new'); // Chạy trình duyệt ở chế độ headless
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');

    // dieu chinh neu chay tren linux arm64
    if (process.platform === 'linux' && process.arch === 'arm64') {
      options.setChromeBinaryPath('/usr/bin/chromium-browser');
    }

    this.driver = await new Builder() // tao Selenium WebDriver
      .forBrowser('chrome') // chon chrome
      .setChromeOptions(options) // ap dung cac option da dinh nghia
      .build(); // khoi tao

    if (cookiesToInject && cookiesToInject.length > 0) {
      await this.driver.get(X_BASE_URL);
      for (const cookie of cookiesToInject) {
        try {
          await this.driver.manage().addCookie(cookie);
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
      const image = await this.driver.takeScreenshot(); // takeScreenshot : WebDriver API
      const filePath = path.join(process.cwd(), `${name}_screenshot_${Date.now()}.png`);
      fs.writeFileSync(filePath, image, 'base64');
      console.log(`Screenshot saved to ${filePath}`);
  }

  private async login(): Promise<void> {
    if (!this.driver) throw new Error("WebDriver not initialized");

    try {
      console.log("Logging in ...");
      await this.driver.get(LOGIN_URL);

      // Email
      await this.driver.wait(until.elementLocated(By.css(INITIAL_INPUT_SELECTOR_CSS)), 15000); // cho element email xuat hien
      const emailInput = await this.driver.findElement(By.css(INITIAL_INPUT_SELECTOR_CSS)); // Lay input email
      await emailInput.sendKeys(this.credentials.email); // dien email tu this.credentials.email

      // Username (neu can)
      await this.driver.wait(until.elementLocated(By.css(INITIAL_INPUT_SELECTOR_CSS)), 15000);
      const usernameInput = await this.driver.findElement(By.css(INITIAL_INPUT_SELECTOR_CSS));
      await usernameInput.sendKeys(this.credentials.username);

      // Password
      await this.driver.wait(until.elementLocated(By.css(PASSWORD_INPUT_SELECTOR_CSS)), 15000);
      const passwordInput = await this.driver.findElement(By.css(PASSWORD_INPUT_SELECTOR_CSS));
      await passwordInput.sendKeys(this.credentials.password);

      const loginBtn = await this.driver.findElement(By.css('div[data-testid="LoginForm_Login_Button"]')); // tạm dùng selector
      await loginBtn.click();

      // Xac nhan login
      await this.driver.wait(
        until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)),
        ELEMENT_LOCATE_TIMEOUT_MS
      );
      console.log("Login successful!");

      // save cookies
      const cookies = await this.driver.manage().getCookies();
      this.saveCookies(cookies);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  public async ensureLoggedIn(): Promise<void> {
    const cookies = this.loadCookies();
    const expired = this.areCookiesExpired(cookies || []);

    if (cookies && !expired) {
      console.log("♻️ Reusing saved cookies...");
      await this.initDriver(cookies);

      try {
        await this.driver!.get(X_BASE_URL);
        await this.driver!.wait(
          until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)),
          ELEMENT_LOCATE_TIMEOUT_MS
        );
        console.log("✅ Session restored from cookies");
        return;
      } catch {
        console.warn("⚠️ Cookies invalid, relogin required");
        await this.closeDriver();
      }
    }

    // ❌ Nếu không có cookies hoặc hết hạn → login mới
    await this.initDriver();
    await this.login();
  }

  // Ham lay tweet(bam vao tweet-> cho chuyen sang status-> lay url -> back)
  private async getTweetUrlViaNavigation(
    driver: WebDriver,
    tweetElement: WebElement // the article cho 1 tweet
  ) : Promise<string> {
    let url = "";
    const originalPageUrl = await driver.getCurrentUrl();//url hien tai
    console.log(`[getTweetUrl] Navigating from ${originalPageUrl} to get tweet URL.`);
    try {
      const timeElem = await tweetElement.findElement(By.css(TIME_SELECTOR_CSS));
      await driver.executeScript("arguments[0].scrollIntoView(true);", timeElem);//click bang js
      
      await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return currentUrl !== originalPageUrl &&  /\/status\//.test(currentUrl);//url phai chua status

      } ELEMENT_LOCATE_TIMEOUT_MS + 5000);
      url = await driver.getCurrentUrl();//lay url sau khi chuyen trang
      console.log(`[getTweetUrl] Retrieved tweet URL: ${url}`);

    }catch (error) {
      console.error("[getTweetUrl] Failed to retrieve tweet URL via navigation:", error);
      await this.captureFailureScreenshot("getTweetUrlError");
      //that bai thi url van la ""
    } finally {//lau url hien tai sau khi try xong
      const urlAfterNavigationAttempt = await driver.getCurrentUrl().catch();

      //dieu huong qua lai trnag goc 
      if (urlAfterNavigationAttempt !== originalPageUrl) {
        console.log(`[getTweetUrl] Navigating back to original page: ${originalPageUrl}`);
        try {
          await driver.navigate().back();//quay lai
          //cho trang goc load xong
          await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS);//doi tweet load
          await driver.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS);//doi cot chinh load
          console.log("[getTweetUrl] Successfully navigated back to original page.");

        }catch (navBackError) {

          console.warn("[getTweetUrl] Navigation back to original page failed:", navBackError);
          await this.captureFailureScreenshot("navigationBackError");
          //dieu huong cung ve trang chu
          try {
            await driver.get(X_BASE_URL+ "/home");//ve thang home de reset trang thai
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
  //trich xuat tweet tu driver hien tai

 public async extractTweets(driver: WebDriver): Promise<Tweet[]> {
  const tweets: Tweet[] = [];//danh sach tweet
  let currentTweetIndexOnPage = 0;//index tweet dang xu li
  const processedTweetIdentifiers = new Set<string>();//luu datatime cua tweet de tranh lap
  let consecutiveScrollsWithoutNewContent = 0;//so lan cuon khong ra tweet moi
  const MAX_CONSECUTIVE_SCROLLS_WITHOUT_NEW_CONTENT = 3; // Scuon 3 lan k co tweet -> dung
  const MAX_TWEETS_TO_PROCESS = 50; // Giới hạn số tweet cần trích xuất

  //vong lap chinh: tiep tuc cho den khi du tweet hoac khong the cuon them
  for (let attempt= 0; tweets.length < MAX_TWEETS_TO_PROCESS && attempt < MAX_TWEETS_TO_PROCESS*3; attempt++) {
    let articles: WebElement[];
    try {
      //tai lai danh sach bai viet
      await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS);
      articles = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));
      let articlesOnPageCount = articles.length;//so bai viet hien co
      console.log(`[extractTweets] Found ${articlesOnPageCount} tweet articles on the page.`);

      //logic tu dong cuon
      if(currentTweetIndexOnPage >= articlesOnPageCount) {//neu duyet het tweet tren man hinh
        if(consecutiveScrollsWithoutNewContent >= MAX_CONSECUTIVE_SCROLLS_WITHOUT_NEW_CONTENT) {
          console.log("[extractTweets] No new tweets found after multiple scrolls. Ending extraction.");
          break;//neu cuon nhieu lan ma khong tim thay bai viet
        }
        console.log(`[extractTweets] Reached end of visible tweets. Attempting to scroll (attempt ${consecutiveScrollsWithoutNewContent + 1}).`);
        await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");//cuon xuong cuoi trang bang js
        await driver.sleep(randomDelay(MEDIUM_DELAY_MIN+1000, MEDIUM_DELAY_MAX+2000));//delay sau khi cuon,random
        const articlesAfterScroll = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));//lay lai danh sach article sau khi cuon
                    if (articlesAfterScroll.length > articlesOnPageCount) {
                        console.log(`[extractTweets] Scrolled and loaded ${articlesAfterScroll.length - articlesOnPageCount} new articles.`);
                        articles = articlesAfterScroll;
                        articlesOnPageCount = articles.length;
                        consecutiveScrollsWithoutNewContent = 0; // Reset counter 
                        console.log("[extractTweets] Scroll did not load new articles. Incrementing no-new-content scroll counter.");
                        consecutiveScrollsWithoutNewContent++;//++ so lan cuon
                    } else {
                    }

                    if (currentTweetIndexOnPage >= articlesOnPageCount) {
                        console.log(`[extractTweets] Still no more articles to process at index ${currentTweetIndexOnPage} after scroll.`);
                        continue; // Quay lại đầu vòng lặp để kiểm tra điều kiện thoát/cuộn lại
                    }
                }
                } catch (e) {
                console.error("[extractTweets] Failed to find or list tweet articles:", e);
                await this.captureFailureScreenshot("extractTweets_articleList_fail");
                break; // Lỗi nghiêm trọng, dừng trích xuất
            }
      //xu li tung tweet
      const el = articles[currentTweetIndexOnPage];
      let tweetTime = "";//tgian post
      let tweetMomentIdentifier = `no_time_idx_${currentTweetIndexOnPage}_${Date.now()}`; //dinh danh(tam thoi) tweet neu khong co time
      try {
        //trich xuat thoi gian
        try{
          const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));//tim the <time>
          tweetTime = await timeElem.getAttribute("datetime");//lay thuoc tinh datetime
          if(tweetTime) {
            tweetMomentIdentifier = tweetTime;//dinh danh tweet bang thoi gian
          }
        }catch(timeError) {
          console.warn(`[extractTweets] Tweet at index ${currentTweetIndexOnPage} has no time element.`);
        }
        if(processedTweetIdentifiers.has(tweetMomentIdentifier)) {//trung tweet
          console.log(`[extractTweets] Tweet with identifier ${tweetMomentIdentifier} already processed. Skipping.`);
          currentTweetIndexOnPage++;//sang tweet tiep 
          attempt--;//khong tinh lan nay, vi day la lan bo qua
          continue;
        }
        //trich xuat du lieu tweet
        let tweetText = "";//luu noi dung
        const textNodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS));//lay mang node
        if(textNodes.length > 0) {
          for(const node of textNodes) {
            tweetText += `${await node.getText()}`;//gop tat ca text thanh nd hoan chinh
              //Node 1: "Hôm nay trời đẹp"
              // Node 2: "#Hanoi"
              // → tweetText = "Hôm nay trời đẹp #Hanoi"

          }
        }
        tweetText = tweetText.trim();

        //bo qua tweet khong co thoi gian hoac text
        if(!tweetTime || tweetText.length === 0) {
          console.warn(`[extractTweets] Tweet at index ${currentTweetIndexOnPage} skipped due to missing time or empty text.`);
          processedTweetIdentifiers.add(tweetMomentIdentifier);//danh dau da xu li
          currentTweetIndexOnPage++;
          continue;
        }

        //trich xuat chi so tuong tac
        let replyCount: number | null = null;
        let retweetCount: number | null = null;
        let likeCount: number | null = null;

        try {
          const replyButton = await el.findElement(By.css(REPLY_COUNT_SELECTOR_CSS));
          replyCount = parseEngagementCount(await replyButton.getText());
        } catch(e) {}

        try {
          const retweetButton = await el.findElement(By.css(RETWEET_COUNT_SELECTOR_CSS));
          retweetCount = parseEngagementCount(await retweetButton.getText());

        } catch(e) {}
        try {
          const likeButton = await el.findElement(By.css(LIKE_COUNT_SELECTOR_CSS));
          likeCount = parseEngagementCount(await likeButton.getText());
        } catch(e) {}

        //lay url (dieu huong va quay lai)
        const tweetUrl = await this.getTweetUrlViaNavigation(driver, el);

        //Luu ket qua
        if(tweetUrl) {
          tweets.push({
            time: tweetTime,
            data: tweetText,
            url: tweetUrl,
            replyCount,
            retweetCount,
            likeCount,
            impressionsCount: null,
          });
          processedTweetIdentifiers.add(tweetMomentIdentifier);//danh dau da xu li
          console.log(`[extractTweets] Collected ${tweets.length}/${MAX_TWEETS_TO_PROCESS} tweet: ${tweetUrl}`);

        } else {
          console.warn(`[extractTweets] Tweet at index ${currentTweetIndexOnPage} skipped due to missing URL.`);
          processedTweetIdentifiers.add(tweetMomentIdentifier);//danh dau da xu li

        }
        currentTweetIndexOnPage++;//chuyen sang tweet tiep theo
      }catch (e) {
        console.error(`[extractTweets] Critical error processing tweet at index ${currentTweetIndexOnPage}. ID: ${tweetMomentIdentifier}:`, e);
                processedTweetIdentifiers.add(tweetMomentIdentifier);
                await this.captureFailureScreenshot(`extractTweets_single_tweet_fail_idx${currentTweetIndexOnPage}`);

                // Nếu lỗi StaleElementReferenceError, vòng lặp ngoài sẽ tải lại list articles
                if (e instanceof Error && (e as any).name !== "StaleElementReferenceError") {
                    currentTweetIndexOnPage++;
                }
      }
      }
      console.log(`[extractTweets] Extraction complete. Total tweets collected: ${tweets.length}`);
      return tweets.sort(
        (a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()); // sap xep giam dan theo thoi gian
    }

    //ham nghiep vu khac
  public async runScraping(xId: string): Promise<Tweet[]> {
        await this.ensureLoggedIn();
        if (!this.driver) {
            console.error("Driver not available after ensureLoggedIn.");
            return [];
        }

        try {
            console.log(`Navigating to account: ${xId}`);
            await this.driver.get(`${X_BASE_URL}/${xId}`);
            await this.driver.wait(
                until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), 
                ELEMENT_LOCATE_TIMEOUT_MS
            );
            return await this.extractTweets(this.driver);
        } catch (error) {
            console.error(`Error in runScraping for ${xId}:`, error);
            await this.captureFailureScreenshot(`runScraping_error_${xId}`);
            return [];
        } finally {
            await this.closeDriver();
        }
    }
}
