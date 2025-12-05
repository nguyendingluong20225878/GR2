export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
export const LOGIN_URL = "https://x.com/i/flow/login";
export const X_BASE_URL = "https://x.com";

// Login Selectors
export const INITIAL_INPUT_SELECTOR_CSS = "input[autocomplete='username']";
export const NEXT_BUTTON_XPATH = "//button[.//span[text()='Next']]";
export const PASSWORD_SELECTOR_CSS = "input[name='password']";
export const USERNAME_VERIFICATION_SELECTOR_CSS = "input[name='text']";
export const PRIMARY_COLUMN_SELECTOR_CSS = "div[data-testid='primaryColumn']";

// Tweet Extraction Selectors
export const TWEET_ARTICLE_SELECTOR_CSS = "article[data-testid='tweet']"; // Đã sửa: Từ div[data-testid='tweetText'] sang article[data-testid='tweet']
export const TIME_SELECTOR_CSS = "time";
export const TWEET_TEXT_SELECTOR_CSS = "div[data-testid='tweetText']";
export const LANG_SELECTOR_CSS = "div[lang]";
export const SHARE_BUTTON_SELECTOR_CSS = "button[aria-label='Share post']";
export const COPY_LINK_MENU_ITEM_XPATH =
  "//div[@data-testid='Dropdown']//div[@role='menuitem'][.//span[contains(text(),'Copy link') or contains(text(),'リンクをコピー')]]";

// Engagement metric selectors
export const REPLY_COUNT_SELECTOR_CSS =
  "button[data-testid='reply'] span[data-testid='app-text-transition-container'] > span > span";
export const RETWEET_COUNT_SELECTOR_CSS =
  "button[data-testid='retweet'] span[data-testid='app-text-transition-container'] > span > span"; // Đã thêm
export const LIKE_COUNT_SELECTOR_CSS =
  "button[data-testid='like'] span[data-testid='app-text-transition-container'] > span > span"; // Đã thêm

// Filesystem Paths (relative to package root, e.g., packages/x-scraper/)
export const COOKIES_DIR_RELATIVE = "./cookies";
export const COOKIES_FILENAME = "x-scraper_cookies.json";
export const SCREENSHOTS_DIR_RELATIVE = "./screenshots";

// Timeouts and Delays (examples, can be adjusted)
export const DEFAULT_SELENIUM_SCRIPT_TIMEOUT = 30000;
export const SHORT_DELAY_MIN = 500;
export const SHORT_DELAY_MAX = 1000;
export const MEDIUM_DELAY_MIN = 700;
export const MEDIUM_DELAY_MAX = 1000;
export const LONG_DELAY_MIN = 700;
export const LONG_DELAY_MAX = 1000;
export const LOGIN_SUCCESS_DELAY_MIN = 3000;
export const LOGIN_SUCCESS_DELAY_MAX = 7000;
export const PAGE_LOAD_WAIT_MS = 7000;
export const ELEMENT_LOCATE_TIMEOUT_MS = 20000;
export const BATCH_PROCESSING_WAIT_MS = 2000; // Cần thiết cho checkXAccounts

export const MAX_TWEETS_TO_PROCESS_PER_ACCOUNT = 20; // Giới hạn số lượng tweet tối đa mỗi lần scrape