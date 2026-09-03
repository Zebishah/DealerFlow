// services/scraper.service.js
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { scrapeAutoTrader } = require("./scrapers/autotrader.scraper");
const { scrapeHumberview } = require("./scrapers/humberview.scraper");
const { scrapeAutoPlanet } = require("./scrapers/autoplanet.scraper");
const { scrapeYorkdaleVW } = require("./scrapers/scrapeyorkdale.scrapper");
const { logAsync } = require("../utils/logger");

puppeteer.use(StealthPlugin());

const launchBrowser = async () => {
  const chromium110 = puppeteer.executablePath("chrome", "110");

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: chromium110,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-web-security",
      "--window-size=1920,1080",
      "--lang=en-CA",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  return browser;
};

const configurePage = async (page) => {
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/109.0.5414.120 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-CA,en;q=0.9",
    "Upgrade-Insecure-Requests": "1",
  });

  await page.emulateTimezone("America/Toronto");

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "platform", { get: () => "Win32" });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-CA", "en"],
    });
    Object.defineProperty(navigator, "permissions", {
      get: () => ({
        query: (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: "denied" })
            : Promise.resolve({ state: "granted" }),
      }),
    });
  });

  await page.setGeolocation({ latitude: 43.6532, longitude: -79.3832 });
  await page.setViewport({ width: 1920, height: 1080 });
};

const scrapeSingleSite = async (page, url, siteName) => {
  try {
    await configurePage(page);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    let result;
    if (siteName === "AutoTrader") {
      result = await scrapeAutoTrader(page, url);
    } else if (siteName === "HumberviewVW") {
      result = await scrapeHumberview(page, url);
    } else if (siteName === "AutoPlanet") {
      result = await scrapeAutoPlanet(page, url);
    } else if (siteName === "YorkdaleVW") {
      result = await scrapeYorkdaleVW(page, url);
    } else {
      throw new Error(`Unknown site: ${siteName}`);
    }

    return result;
  } catch (err) {
    logAsync("error", `${siteName} failed: ${err.message}`);
    return {
      cars: [],
      total: 0,
      serverError: err.message || "Unknown error",
    };
  }
};

// Main function: scrapes all sites with ONE browser
const scrapeAllSites = async (urls) => {
  let browser = null;

  try {
    browser = await launchBrowser();
    logAsync("info", "Browser launched for scraping session");

    const scrapePromises = [];

    // Open pages in parallel for each site
    if (urls.autotrader) {
      scrapePromises.push(
        browser
          .newPage()
          .then((page) => scrapeSingleSite(page, urls.autotrader, "AutoTrader"))
          .then((result) => ({ site: "autotrader", result }))
          .catch((error) => ({
            site: "autotrader",
            result: { cars: [], total: 0, serverError: error.message },
          }))
      );
    }

    if (urls.humberview) {
      scrapePromises.push(
        browser
          .newPage()
          .then((page) =>
            scrapeSingleSite(page, urls.humberview, "HumberviewVW")
          )
          .then((result) => ({ site: "humberview", result }))
          .catch((error) => ({
            site: "humberview",
            result: { cars: [], total: 0, serverError: error.message },
          }))
      );
    }

    if (urls.yorkdalevw) {
      scrapePromises.push(
        browser
          .newPage()
          .then((page) => scrapeSingleSite(page, urls.yorkdalevw, "YorkdaleVW"))
          .then((result) => ({ site: "yorkdalevw", result }))
          .catch((error) => ({
            site: "yorkdalevw",
            result: { cars: [], total: 0, serverError: error.message },
          }))
      );
    }

    if (urls.autoplanet) {
      scrapePromises.push(
        browser
          .newPage()
          .then((page) => scrapeSingleSite(page, urls.autoplanet, "AutoPlanet"))
          .then((result) => ({ site: "autoplanet", result }))
          .catch((error) => ({
            site: "autoplanet",
            result: { cars: [], total: 0, serverError: error.message },
          }))
      );
    }

    const scrapeResults = await Promise.all(scrapePromises);

    // Convert to object format
    const results = {};
    scrapeResults.forEach(({ site, result }) => {
      results[site] = result;
    });

    return results;
  } finally {
    // ALWAYS close browser after scraping
    if (browser) {
      try {
        await browser.close();
        logAsync("info", "Browser closed successfully");
      } catch (err) {
        logAsync("error", `Error closing browser: ${err.message}`);
      }
    }
  }
};

// Graceful shutdown (in case of server restart)
const cleanup = async () => {
  logAsync("info", "Process cleanup initiated");
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

module.exports = { scrapeAllSites };
