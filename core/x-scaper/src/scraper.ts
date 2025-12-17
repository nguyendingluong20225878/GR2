import fs from "fs";
import path from "path";

import { Logger, LogLevel } from "../../shared/src";
import {
  Builder,
  By,
  Key,
  until,
  WebDriver,
  WebElement,
  IWebDriverOptionsCookie as SeleniumCookie,
} from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

import { getAllXAccounts, saveTweets } from "./db";
import { randomDelay } from "./utils";
import {
  LOGIN_URL,
  X_BASE_URL,
  INITIAL_INPUT_SELECTOR_CSS,
  PASSWORD_SELECTOR_CSS,
  USERNAME_VERIFICATION_SELECTOR_CSS,
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
  LOGIN_SUCCESS_DELAY_MIN,
  LOGIN_SUCCESS_DELAY_MAX,
  NEXT_BUTTON_XPATH,
  COOKIES_DIR_RELATIVE,
  COOKIES_FILENAME,
  SCREENSHOTS_DIR_RELATIVE,
  MAX_TWEETS_TO_PROCESS_PER_ACCOUNT,
} from "./constant";

/* ======================= TYPES ======================= */

interface Credentials {
  email: string;
  password: string;
  username: string;
}

interface Tweet {
  time: string;
  data: string;
  url: string;
  replyCount: number | null;
  retweetCount: number | null;
  likeCount: number | null;
  impressionsCount: number | null;
}

/* ======================= UTILS ======================= */

function parseEngagementCount(text: string | null): number | null {
  if (!text) return null;

  const clean = text.replace(/,/g, "").toUpperCase();
  const num = parseFloat(clean);

  if (Number.isNaN(num)) return null;

  if (clean.includes("K")) return Math.round(num * 1_000);
  if (clean.includes("M")) return Math.round(num * 1_000_000);

  return num;
}

/* ======================= SCRAPER ======================= */

export class XScraper {
  private driver: WebDriver | null = null;
  private credentials: Credentials;
  private logger = new Logger({ level: LogLevel.INFO });

  constructor(credentials: Credentials) {
    this.credentials = credentials;
  }

  /* ======================= COOKIES ======================= */

  private getCookiesFilePath(): string {
    const dir = path.resolve(process.cwd(), COOKIES_DIR_RELATIVE);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, COOKIES_FILENAME);
  }

  private loadCookies(): any[] | null {
    const filePath = this.getCookiesFilePath();
    if (!fs.existsSync(filePath)) return null;

    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return null;
    }
  }

  private saveCookies(cookies: any[]): void {
    fs.writeFileSync(
      this.getCookiesFilePath(),
      JSON.stringify(cookies, null, 2)
    );
  }

  private areCookiesExpired(cookies: any[]): boolean {
    if (!cookies.length) return true;

    const now = Date.now();
    return cookies.some(
      (c) => typeof c.expiry === "number" && c.expiry * 1000 < now
    );
  }

  /* ======================= DRIVER ======================= */

  private async initDriver(cookies?: any[]): Promise<void> {
    const options = new chrome.Options();

    options.addArguments(
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    );

    this.driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    await this.driver.manage().setTimeouts({
      script: DEFAULT_SELENIUM_SCRIPT_TIMEOUT,
    });

    if (cookies?.length) {
      await this.driver.get(X_BASE_URL);
      for (const cookie of cookies) {
        try {
          await this.driver.manage().addCookie(cookie as SeleniumCookie);
        } catch {
          /* ignore invalid cookies */
        }
      }
    }
  }

  private async closeDriver(): Promise<void> {
    if (!this.driver) return;
    await this.driver.quit();
    this.driver = null;
  }

  private async captureFailureScreenshot(name: string): Promise<void> {
    if (!this.driver) return;

    const img = await this.driver.takeScreenshot();
    const dir = path.resolve(process.cwd(), SCREENSHOTS_DIR_RELATIVE);

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${name}_${Date.now()}.png`),
      img,
      "base64"
    );
  }

  /* ======================= LOGIN ======================= */

  private async login(): Promise<void> {
    if (!this.driver) throw new Error("Driver not initialized");

    try {
      this.logger.info("login", "Logging in …");

      await this.driver.get(LOGIN_URL);
      
      const initialInputSelector = By.css(INITIAL_INPUT_SELECTOR_CSS);
      await this.driver.wait(until.elementLocated(initialInputSelector), ELEMENT_LOCATE_TIMEOUT_MS);
      const emailOrUsernameInput = await this.driver.findElement(initialInputSelector);
      
      await this.driver.wait(until.elementIsVisible(emailOrUsernameInput), ELEMENT_LOCATE_TIMEOUT_MS);
      await this.driver.wait(until.elementIsEnabled(emailOrUsernameInput), ELEMENT_LOCATE_TIMEOUT_MS);
      
      await emailOrUsernameInput.sendKeys(this.credentials.email);
      await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));

      const nextButton = await this.driver.findElement(By.xpath(NEXT_BUTTON_XPATH));
      await this.driver.wait(until.elementIsEnabled(nextButton), ELEMENT_LOCATE_TIMEOUT_MS);
      await nextButton.click();
      this.logger.info("login", "Initial input (email) submitted via Next button click.");

      // Wait for page transition after clicking Next
      const passwordSelector = By.css(PASSWORD_SELECTOR_CSS);
      const usernameVerificationSelector = By.css(USERNAME_VERIFICATION_SELECTOR_CSS);
      const expectedUrlPattern = /login\/(identifier|password)/;

      try {
        await this.driver.wait(async () => {
          const currentUrl = await this.driver.getCurrentUrl();
          const passwordField = await this.driver.findElements(passwordSelector);
          const usernameField = await this.driver.findElements(usernameVerificationSelector);
          return expectedUrlPattern.test(currentUrl) || passwordField.length > 0 || usernameField.length > 0;
        }, ELEMENT_LOCATE_TIMEOUT_MS * 4);
        this.logger.info("login", `Page transitioned. Current URL: ${await this.driver.getCurrentUrl()}`);
      } catch (transitionError) {
        this.logger.error("login", "Page did not transition after email submission", {
          error: transitionError instanceof Error ? transitionError.message : String(transitionError),
          url: await this.driver.getCurrentUrl(),
        });
        throw transitionError;
      }

      // Handle EITHER username verification OR password input
      const passwordElements = await this.driver.findElements(passwordSelector);
      if (passwordElements.length > 0) {
        this.logger.info("login", "Password input field found directly after email submission.");
      } else {
        // Check for username verification step
        try {
          await this.driver.wait(until.elementLocated(usernameVerificationSelector), ELEMENT_LOCATE_TIMEOUT_MS / 2);
          const usernameInput = await this.driver.findElement(usernameVerificationSelector);
          await this.driver.wait(until.elementIsVisible(usernameInput), ELEMENT_LOCATE_TIMEOUT_MS / 2);
          await this.driver.wait(until.elementIsEnabled(usernameInput), ELEMENT_LOCATE_TIMEOUT_MS / 2);

          this.logger.info("login", "Username verification step detected. Entering username...");
          await usernameInput.sendKeys(this.credentials.username);
          await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));

          // Wait for any toast notifications to disappear
          try {
            const toastSelector = By.css("div[data-testid='toast']");
            const toastElements = await this.driver.findElements(toastSelector);
            if (toastElements.length > 0) {
              this.logger.info("login", "Toast notification detected, waiting for it to disappear...");
              await this.driver.wait(async () => {
                const toasts = await this.driver.findElements(toastSelector);
                return toasts.length === 0;
              }, ELEMENT_LOCATE_TIMEOUT_MS);
              await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
            }
          } catch {
            // No toast or toast already disappeared, continue
          }

          const usernameNextButton = await this.driver.findElement(By.xpath(NEXT_BUTTON_XPATH));
          await this.driver.wait(until.elementIsEnabled(usernameNextButton), ELEMENT_LOCATE_TIMEOUT_MS);
          
          // Try JavaScript click first to bypass any overlays
          try {
            await this.driver.executeScript("arguments[0].click();", usernameNextButton);
            this.logger.info("login", "Username Next button clicked via JavaScript");
          } catch {
            // Fallback to normal click
            await usernameNextButton.click();
            this.logger.info("login", "Username Next button clicked via normal click");
          }

          this.logger.info("login", "Username submitted for verification via Next button click.");
          
          // Wait a bit for page transition
          await this.driver.sleep(randomDelay(MEDIUM_DELAY_MIN + 2000, MEDIUM_DELAY_MAX + 3000));
          
          // Check for captcha or verification challenges
          try {
            const captchaSelectors = [
              "iframe[src*='captcha']",
              "iframe[src*='recaptcha']",
              "div[data-testid='ocfChallenge']",
              "div[data-testid='challenge']",
              "div[role='alert']:not([data-testid='toast'])",
            ];
            
            for (const selector of captchaSelectors) {
              const elements = await this.driver.findElements(By.css(selector));
              if (elements.length > 0) {
                this.logger.warn("login", `Captcha or verification challenge detected (${selector}) - manual intervention may be required`);
                await this.captureFailureScreenshot("login_captcha_detected");
                // Don't throw, continue to try finding password field
              }
            }
          } catch {
            // Ignore errors in captcha detection
          }
          
          // Check current URL to see if we're still on login page
          const urlAfterUsername = await this.driver.getCurrentUrl();
          this.logger.info("login", `URL after username submit: ${urlAfterUsername}`);
          
          // Try to find password field with multiple strategies
          let passwordFound = false;
          const passwordSelectors = [
            passwordSelector,
            By.css("input[name='password']"),
            By.css("input[type='password']"),
            By.css("input[autocomplete='current-password']"),
            By.css("input[autocomplete='password']"),
          ];
          
          for (const selector of passwordSelectors) {
            try {
              await this.driver.wait(until.elementLocated(selector), 10000);
              passwordFound = true;
              this.logger.info("login", `Password field found with selector: ${selector}`);
              break;
            } catch {
              continue;
            }
          }
          
          if (!passwordFound) {
            // Take screenshot for debugging
            await this.captureFailureScreenshot("login_password_not_found_after_username");
            const pageSource = await this.driver.getPageSource().catch(() => "Unable to get page source");
            this.logger.error("login", `Password field not found after username submission. Page source snippet: ${pageSource.substring(0, 1000)}`);
            throw new Error("Password field did not appear after username verification");
          }
        } catch (e) {
          this.logger.error("login", "Failed to handle username verification step or password field did not appear", e);
          throw e;
        }
      }

      // Password Input Logic
      const passwordInput = await this.driver.findElement(passwordSelector);
      await this.driver.wait(until.elementIsVisible(passwordInput), ELEMENT_LOCATE_TIMEOUT_MS);
      await this.driver.wait(until.elementIsEnabled(passwordInput), ELEMENT_LOCATE_TIMEOUT_MS);
      await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
      await passwordInput.sendKeys(this.credentials.password);
      await this.driver.sleep(randomDelay(SHORT_DELAY_MIN, SHORT_DELAY_MAX));
      await passwordInput.sendKeys(Key.RETURN);
      this.logger.info("login", "Password submitted.");

      await this.driver.sleep(randomDelay(LOGIN_SUCCESS_DELAY_MIN, LOGIN_SUCCESS_DELAY_MAX));
      await this.driver.wait(
        until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)),
        ELEMENT_LOCATE_TIMEOUT_MS * 4.5
      );

      this.logger.info("login", "Login successful");
      this.saveCookies(await this.driver.manage().getCookies());
    } catch (error) {
      await this.captureFailureScreenshot("login_fail");
      throw error;
    }
  }

  public async ensureLoggedIn(): Promise<boolean> {
    this.logger.info("ensureLoggedIn", "Ensuring logged-in session...");

    if (!this.driver) {
      const cookies = this.loadCookies();
      await this.initDriver(
        cookies && !this.areCookiesExpired(cookies) ? cookies : undefined
      );
    }

    if (!this.driver) {
      this.logger.error("ensureLoggedIn", "Failed to initialize driver");
      return false;
    }

    // Check session validity
    const cookies = this.loadCookies();
    if (cookies && cookies.length > 0 && !this.areCookiesExpired(cookies)) {
      this.logger.info("ensureLoggedIn", "Session cookies found and are not expired. Verifying session activity...");
      try {
        const currentUrl = await this.driver.getCurrentUrl();
        if (!currentUrl.includes(`${X_BASE_URL}/home`)) {
          this.logger.info("ensureLoggedIn", `Not on home page (${currentUrl}), navigating to verify session.`);
          await this.driver.get(`${X_BASE_URL}/home`);
        }
        await this.driver.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS);
        this.logger.info("ensureLoggedIn", "Session is active and verified via /home page.");
        return true;
      } catch (e) {
        this.logger.warn("ensureLoggedIn", "Cookies are present but session verification failed", {
          error: e instanceof Error ? e.message : String(e),
        });
        await this.captureFailureScreenshot("session_verification_fail");
      }
    }

    // If session is not active/verified, attempt login
    this.logger.info("ensureLoggedIn", "Session not active or cookies invalid/expired. Attempting full login.");
    if (this.driver) {
      await this.closeDriver();
    }
    await this.initDriver();
    if (!this.driver) {
      this.logger.error("ensureLoggedIn", "Failed to re-init driver before login attempt");
      return false;
    }

    try {
      await this.login();
      this.logger.info("ensureLoggedIn", "Login successful via ensureLoggedIn.");
      return true;
    } catch (error) {
      this.logger.error("ensureLoggedIn", "Login failed via ensureLoggedIn", error);
      await this.captureFailureScreenshot("ensureLoggedIn_login_fail");
      if (this.driver) {
        await this.closeDriver();
      }
      return false;
    }
  }

  /* ======================= PHẦN SCRAPE (GIỮ NGUYÊN LOGIC) ======================= */

  private async getTweetUrlViaNavigation(
    driver: WebDriver,
    tweetElement: WebElement
  ): Promise<string> {
    let url = "";
    const originalPageUrl = await driver.getCurrentUrl();

    try {
      const timeElem = await tweetElement.findElement(By.css(TIME_SELECTOR_CSS));
      await driver.executeScript("arguments[0].click();", timeElem);

      await driver.wait(async () => {
        const currentUrl = await driver.getCurrentUrl();
        return currentUrl !== originalPageUrl && /\/status\//.test(currentUrl);
      }, ELEMENT_LOCATE_TIMEOUT_MS + 5000);

      url = await driver.getCurrentUrl();
      this.logger.info("getTweetUrl", `Successfully navigated to tweet detail page: ${url}`);
    } catch (e) {
      this.logger.error("getTweetUrl", "Navigation-based URL fetch failed", {
        error: e instanceof Error ? e.message : String(e),
        originalUrl: originalPageUrl,
        currentUrlAttempt: await driver.getCurrentUrl().catch(() => "failed to get current URL"),
      });
      await this.captureFailureScreenshot("getTweetUrlViaNavigation_nav_fail");
    } finally {
      const urlAfterNavigationAttempt = await driver.getCurrentUrl().catch(() => originalPageUrl);
      
      if (urlAfterNavigationAttempt !== originalPageUrl && /\/status\//.test(urlAfterNavigationAttempt)) {
        try {
          await driver.navigate().back();
          await driver.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS);
          await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS);
          this.logger.info("getTweetUrl", "Successfully navigated back and timeline reloaded.");
        } catch (navBackError) {
          this.logger.warn("getTweetUrl", "Failed to navigate back. Attempting recovery.", {
            error: navBackError instanceof Error ? navBackError.message : String(navBackError),
          });
          await this.captureFailureScreenshot("getTweetUrlViaNavigation_navBack_fail");
          try {
            await driver.get(`${X_BASE_URL}/home`);
            await driver.wait(until.elementLocated(By.css(PRIMARY_COLUMN_SELECTOR_CSS)), PAGE_LOAD_WAIT_MS);
            await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS);
            this.logger.info("getTweetUrl", "Recovery to /home successful.");
          } catch (recoveryError) {
            this.logger.error("getTweetUrl", "Recovery attempt to /home failed", {
              error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
            });
            await this.captureFailureScreenshot("getTweetUrlViaNavigation_recovery_fail");
          }
        }
      }
    }

    return url;
  }

  public async extractTweets(driver: WebDriver): Promise<Tweet[]> {
    const MAX_TWEETS = MAX_TWEETS_TO_PROCESS_PER_ACCOUNT;
    const tweets: Tweet[] = [];
    let currentTweetIndexOnPage = 0;
    const processedTweetIdentifiers = new Set<string>();
    let consecutiveScrollsWithoutNewContent = 0;
    const MAX_CONSECUTIVE_SCROLLS_WITHOUT_NEW_CONTENT = 3;
    let articlesOnPageCount = 0;

    for (
      let attempt = 0;
      tweets.length < MAX_TWEETS && attempt < MAX_TWEETS * 3;
      attempt++
    ) {
      let articles: WebElement[];
      try {
        await driver.wait(until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)), ELEMENT_LOCATE_TIMEOUT_MS);
        articles = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));
        articlesOnPageCount = articles.length;

        if (currentTweetIndexOnPage >= articlesOnPageCount) {
          if (consecutiveScrollsWithoutNewContent >= MAX_CONSECUTIVE_SCROLLS_WITHOUT_NEW_CONTENT) {
            this.logger.info("extractTweets", "Max consecutive scrolls without new content reached. Stopping extraction.");
            break;
          }
          this.logger.info("extractTweets", `Reached end of ${articlesOnPageCount} visible tweets. Attempting to scroll.`);
          await driver.executeScript("window.scrollTo(0, document.body.scrollHeight);");
          await driver.sleep(randomDelay(MEDIUM_DELAY_MIN + 1000, MEDIUM_DELAY_MAX + 2000));

          const articlesAfterScroll = await driver.findElements(By.css(TWEET_ARTICLE_SELECTOR_CSS));
          if (articlesAfterScroll.length > articlesOnPageCount) {
            articles = articlesAfterScroll;
            articlesOnPageCount = articles.length;
            consecutiveScrollsWithoutNewContent = 0;
          } else {
            consecutiveScrollsWithoutNewContent++;
          }
          continue;
        }
      } catch (e) {
        this.logger.error("extractTweets", "Failed to find or list tweet articles", {
          error: e instanceof Error ? e.message : String(e),
        });
        await this.captureFailureScreenshot("extractTweets_articleList_fail");
        break;
      }

      if (currentTweetIndexOnPage >= articlesOnPageCount) {
        break;
      }

      const el = articles[currentTweetIndexOnPage];
      let tweetTime = "";
      let tweetMomentIdentifier = `no_time_idx_${currentTweetIndexOnPage}_${Date.now()}`;

      try {
        try {
          const timeElem = await el.findElement(By.css(TIME_SELECTOR_CSS));
          tweetTime = await timeElem.getAttribute("datetime");
          if (tweetTime) tweetMomentIdentifier = tweetTime;
        } catch (timeError) {
          this.logger.warn("extractTweets", `Could not find time element for article at index ${currentTweetIndexOnPage}`);
        }

        if (processedTweetIdentifiers.has(tweetMomentIdentifier)) {
          currentTweetIndexOnPage++;
          attempt--;
          continue;
        }

        let tweetText = "";
        const textNodes = await el.findElements(By.css(TWEET_TEXT_SELECTOR_CSS));
        if (textNodes.length > 0) {
          for (const node of textNodes) {
            tweetText += `${await node.getText()} `;
          }
        }
        tweetText = tweetText.trim();

        if (!tweetTime || !tweetText) {
          processedTweetIdentifiers.add(tweetMomentIdentifier);
          currentTweetIndexOnPage++;
          continue;
        }

        // Extract engagement metrics BEFORE navigation
        let replyCount: number | null = null;
        let retweetCount: number | null = null;
        let likeCount: number | null = null;

        try {
          const replyButton = await el.findElement(By.css(REPLY_COUNT_SELECTOR_CSS));
          const replyText = await replyButton.getText();
          replyCount = parseEngagementCount(replyText);
        } catch (e) {
          this.logger.warn("extractTweets", `Could not find or parse reply count for tweet: ${tweetMomentIdentifier}`);
        }

        try {
          const retweetButton = await el.findElement(By.css(RETWEET_COUNT_SELECTOR_CSS));
          const retweetText = await retweetButton.getText();
          retweetCount = parseEngagementCount(retweetText);
        } catch (e) {
          this.logger.warn("extractTweets", `Could not find or parse retweet count for tweet: ${tweetMomentIdentifier}`);
        }

        try {
          const likeButton = await el.findElement(By.css(LIKE_COUNT_SELECTOR_CSS));
          const likeText = await likeButton.getText();
          likeCount = parseEngagementCount(likeText);
        } catch (e) {
          this.logger.warn("extractTweets", `Could not find or parse like count for tweet: ${tweetMomentIdentifier}`);
        }

        const tweetUrl = await this.getTweetUrlViaNavigation(driver, el);

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
          this.logger.info("extractTweets", `Successfully extracted tweet (${tweets.length}/${MAX_TWEETS}): ${tweetUrl}`);
        } else {
          this.logger.warn("extractTweets", "Skipping tweet because URL could not be fetched.", {
            time: tweetTime,
            text: tweetText,
            index: currentTweetIndexOnPage,
            identifier: tweetMomentIdentifier,
          });
          processedTweetIdentifiers.add(tweetMomentIdentifier);
        }
        currentTweetIndexOnPage++;
      } catch (e) {
        this.logger.error("extractTweets", `Critical error processing single tweet at index ${currentTweetIndexOnPage}`, {
          error: e instanceof Error ? e.message : String(e),
        });
        processedTweetIdentifiers.add(tweetMomentIdentifier);
        await this.captureFailureScreenshot(`extractTweets_single_tweet_fail_idx${currentTweetIndexOnPage}`);

        if (e instanceof Error && e.name === "StaleElementReferenceError") {
          this.logger.warn("extractTweets", `StaleElementReferenceError for tweet at index ${currentTweetIndexOnPage}`);
        } else {
          currentTweetIndexOnPage++;
        }
      }
    }

    this.logger.info("extractTweets", `Finished extraction attempt. Total tweets collected: ${tweets.length}`);
    return tweets.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }

  /* ======================= BUSINESS ======================= */

  public async checkSingleAccount(xId: string, closeDriverAfter: boolean = true): Promise<Date | null> {
    await this.ensureLoggedIn();
    if (!this.driver) return null;

    try {
      this.logger.info("checkSingleAccount", `Checking X account: ${xId}`);
      await this.driver.get(`${X_BASE_URL}/${xId}`);
      await this.driver.sleep(PAGE_LOAD_WAIT_MS);
      await this.driver.wait(
        until.elementLocated(By.css(TWEET_ARTICLE_SELECTOR_CSS)),
        ELEMENT_LOCATE_TIMEOUT_MS
      );

      const extractedTweets = await this.extractTweets(this.driver);
      this.logger.info("checkSingleAccount", `Extracted ${extractedTweets.length} tweets from ${xId}`);

      if (!extractedTweets.length) {
        this.logger.warn("checkSingleAccount", `No tweets found for ${xId}`);
        await this.captureFailureScreenshot("checkSingleAccount_no_tweets");
        return null;
      }

      const accounts = await getAllXAccounts();
      const account = accounts.find((a) => a.id === xId);
      if (!account) {
        this.logger.error("checkSingleAccount", `Account ${xId} not found in database`);
        return null;
      }

      const newTweets = extractedTweets.filter((tweet) => {
        const tweetDate = new Date(tweet.time);
        return !account.lastTweetUpdatedAt || tweetDate > new Date(account.lastTweetUpdatedAt);
      });

      if (!newTweets.length) {
        this.logger.info("checkSingleAccount", `No new tweets found for ${xId} since ${account.lastTweetUpdatedAt ? new Date(account.lastTweetUpdatedAt).toISOString() : "the beginning"}.`);
        return null;
      }

      this.logger.info("checkSingleAccount", `Found ${newTweets.length} new tweets for ${xId}.`);
      const latestTweetTimestampProcessed = await saveTweets(xId, newTweets);

      if (latestTweetTimestampProcessed) {
        this.logger.info("checkSingleAccount", `Change detected for ${xId}. New latest tweet timestamp: ${latestTweetTimestampProcessed.toISOString()}`);
        return latestTweetTimestampProcessed;
      } else {
        this.logger.info("checkSingleAccount", `No change for ${xId} after attempting to save new tweets.`);
        return null;
      }
    } catch (error) {
      this.logger.error("checkSingleAccount", `Error checking account ${xId}:`, error);
      await this.captureFailureScreenshot(`checkSingleAccount_error_${xId}`);
      return null;
    } finally {
      if (closeDriverAfter) {
        await this.closeDriver();
      }
    }
  }

  public async runScraping(_: string): Promise<Tweet[]> {
    this.logger.warn(
      "runScraping",
      "Deprecated – use checkSingleAccount instead"
    );
    return [];
  }

  public async checkXAccounts(): Promise<{ processed: number; success: number }> {
    const accounts = await getAllXAccounts();
    if (accounts.length === 0) {
      this.logger.warn("checkXAccounts", "No X accounts found in the database.");
      return { processed: 0, success: 0 };
    }

    let processed = 0;
    let success = 0;

    for (const acc of accounts) {
      try {
        this.logger.info("checkXAccounts", `Processing ${acc.id}`);
        const ts = await this.checkSingleAccount(acc.id, false); // Don't close driver after each account
        if (ts) success++;
      } catch (error) {
        this.logger.error("checkXAccounts", `Error processing account ${acc.id}:`, error);
      } finally {
        processed++;
        if (processed < accounts.length) {
          await new Promise((r) =>
            setTimeout(r, randomDelay(5000, 15000))
          );
        }
      }
    }

    // Close driver after all accounts are processed
    await this.closeDriver();
    return { processed, success };
  }
}
