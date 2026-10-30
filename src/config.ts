/**
 * Share link settings.
 *
 * TELEGRAM_BOT — bot username without @ (e.g. 'CoffeeBrewingBot').
 * TELEGRAM_APP — short name from /newapp (if created). Empty — the bot's
 *   main Mini App is used: BotFather → Bot Settings → Configure Mini App.
 * Without a bot the link leads to the web version.
 */
export const TELEGRAM_BOT = 'CoffeeBrewingBot';
export const TELEGRAM_APP = '';
export const WEB_URL = 'https://5enq.github.io/CoffeeBrewingBot/';

/**
 * Ratings server address (worker/ folder, Cloudflare Workers), e.g.
 * 'https://brewbook-ratings.<your-subdomain>.workers.dev'. Empty — friends' ratings are off.
 */
export const RATINGS_API = 'https://brewbook-ratings.brewbook.workers.dev';
