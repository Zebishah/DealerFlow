const express = require("express");
const { buildUrls } = require("../services/url-builder.service");
const { scrapeAllSites } = require("../services/scraper.service");
const { logAsync } = require("../utils/logger");

const router = express.Router();

const TOTAL_REQUEST_TIMEOUT = 180000; // 3 minutes

router.post("/run", async (req, res) => {
  const filters = req.body;
  const start = Date.now();

  req.setTimeout(TOTAL_REQUEST_TIMEOUT);
  res.setTimeout(TOTAL_REQUEST_TIMEOUT);

  let responseSent = false;

  const timeoutHandler = setTimeout(() => {
    if (!responseSent) {
      responseSent = true;
      logAsync(
        "warn",
        `Request timeout after ${((Date.now() - start) / 1000).toFixed(2)}s`
      );

      res.status(408).json({
        success: false,
        error: "Request timeout - scraping took too long",
        filters,
        duration: `${((Date.now() - start) / 1000).toFixed(2)}s`,
      });
    }
  }, TOTAL_REQUEST_TIMEOUT);

  try {
    const urls = buildUrls(filters);
    const sitesToScrape = Object.keys(urls).filter((key) => urls[key]);

    logAsync("info", `Starting scrape: ${sitesToScrape.join(", ")}`);

    // Single browser, multiple tabs
    const results = await scrapeAllSites(urls);

    clearTimeout(timeoutHandler);

    if (responseSent) return;

    const duration = Date.now() - start;
    const totalCars = Object.values(results).reduce(
      (sum, r) => sum + r.total,
      0
    );
    const summary = Object.entries(results).map(([site, data]) => ({
      site,
      cars: data.total,
      error: data.serverError || null,
    }));

    logAsync(
      "success",
      `Completed in ${(duration / 1000).toFixed(2)}s - Total cars: ${totalCars}`
    );

    responseSent = true;
    res.json({
      success: true,
      results,
      urls,
      filters,
      duration: `${(duration / 1000).toFixed(2)}s`,
      totalCars,
      summary,
    });
  } catch (error) {
    clearTimeout(timeoutHandler);

    if (!responseSent) {
      logAsync("error", `Scrape failed: ${error.message}`);

      responseSent = true;
      res.status(500).json({
        success: false,
        error: error.message,
        filters,
      });
    }
  }
});

router.get("/health", async (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
