export const LOGIN_URL ='https://x.com/i/flow/login';
export const X_BASE_URL ='https://x.com';

// selector 
export const INITIAL_INPUT_SELECTOR_CSS = "input[autocomplete='username']";
export const PASSWORD_INPUT_SELECTOR_CSS = "input[autocomplete='current-password']";
export const TWEET_ARTICLE_SELECTOR_CSS = "div[data-testid='tweetText']";



export const TIME_SELECTOR_CSS = "time";


export const DEFAULT_SELENIUM_SCRIPT_TIMEOUT = 30000; // Reverted to 30s
export const SHORT_DELAY_MIN = 500;
export const SHORT_DELAY_MAX = 1000; // Kept short
export const MEDIUM_DELAY_MIN = 700; // Kept short
export const MEDIUM_DELAY_MAX = 1000; // Kept short
export const LONG_DELAY_MIN = 700; // Kept short (though not heavily used)
export const LONG_DELAY_MAX = 1000; // Kept short (though not heavily used)
export const LOGIN_SUCCESS_DELAY_MIN = 3000; // Reverted to 3s
export const LOGIN_SUCCESS_DELAY_MAX = 7000; // Reverted to 7s
export const PAGE_LOAD_WAIT_MS = 7000; 
export const ELEMENT_LOCATE_TIMEOUT_MS = 20000; 

export const REPLY_COUNT_SELECTOR_CSS =
  "button[data-testid='reply'] span[data-testid='app-text-transition-container'] > span > span";