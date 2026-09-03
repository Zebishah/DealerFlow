// services/scrapers/yorkdale.scraper.js
const { logAsync } = require("../../utils/logger");

// Helper function to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scrapeYorkdaleVW = async (page, baseUrl) => {
  const result = { cars: [], total: 0, serverError: null };

  try {
    await logAsync("info", "START: YorkdaleVW scraper", { url: page.url() });

    // -------------------------------------------------
    // 1. Wait for initial load and check results count
    // -------------------------------------------------
    try {
      await page.waitForSelector(".results-cell .results", {
        timeout: 60_000,
      });
    } catch (e) {
      await logAsync("error", "Initial load timeout", { error: e.message });
      throw new Error("Initial load timeout – no results element found");
    }

    // Wait for content to stabilize
    await wait(5000);
    try {
      await page.waitForSelector(".active-filters-count", { timeout: 10_000 });

      const { filterCount, hasKeyword } = await page.evaluate(() => {
        const filterEl = document.querySelector(".active-filters-count");
        const count = filterEl ? parseInt(filterEl.textContent.trim(), 10) : 0;

        // Check if keyword search has a value
        const searchInput = document.querySelector(".st-keyword-search");
        const keyword = searchInput ? searchInput.value.trim() : "";

        return {
          filterCount: isNaN(count) ? 0 : count,
          hasKeyword: keyword.length > 0,
        };
      });

      // Only return empty if no filters AND no keyword
      if (filterCount === 0 && !hasKeyword) {
        await logAsync(
          "info",
          "No filters or keyword applied — skipping scrape and returning empty result"
        );
        return { cars: [], total: 0, serverError: null };
      }
    } catch (e) {
      await logAsync("warn", "Could not detect filter count or keyword", {
        error: e.message,
      });
    }
    // -------------------------------------------------
    // 2. Get total results count
    // -------------------------------------------------
    const totalResults = await page.evaluate(() => {
      const resultsEl = document.querySelector(".results-cell .results");
      if (!resultsEl) return 0;

      const text = resultsEl.textContent.trim();
      const match = text.match(/(\d+)\s*Results?/i);
      return match ? parseInt(match[1], 10) : 0;
    });

    await logAsync("info", `Total results available: ${totalResults}`);

    // Check for zero results
    if (totalResults === 0) {
      await logAsync(
        "info",
        "Zero results detected - no vehicles match filters"
      );
      return { cars: [], total: 0, serverError: null };
    }

    // -------------------------------------------------
    // 3. Wait for cards to load
    // -------------------------------------------------
    try {
      await page.waitForSelector(".vlp-cards-base .cell.card", {
        timeout: 60_000,
      });
    } catch (e) {
      await logAsync("error", "No cards found after initial load", {
        error: e.message,
      });
      throw new Error("No cards found – cards failed to load");
    }

    const CARDS_PER_PAGE = 12;
    const totalPages = Math.ceil(totalResults / CARDS_PER_PAGE);

    await logAsync(
      "info",
      `Expected ${totalPages} pages with ${CARDS_PER_PAGE} cards per page`
    );

    const allCars = [];
    let currentPage = 1;

    // -------------------------------------------------
    // 4. Loop through all pages
    // -------------------------------------------------
    while (currentPage <= totalPages) {
      await logAsync("info", `Processing page ${currentPage} of ${totalPages}`);

      // Wait for cards to be visible
      try {
        await page.waitForSelector(".vlp-cards-base .cell.card", {
          timeout: 60_000,
        });
      } catch (e) {
        await logAsync("error", `No cards found on page ${currentPage}`, {
          error: e.message,
        });
        break;
      }

      // Wait for cards to have data attributes with retries
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.waitForFunction(
            () => {
              const cards = document.querySelectorAll(
                ".vlp-cards-base .cell.card"
              );
              const cardsWithData = Array.from(cards).filter(
                (card) =>
                  card.dataset.inventoryitemid &&
                  card.dataset.inventoryitemid.trim() !== ""
              ).length;
              // Accept if at least 80% of cards have data
              return cards.length > 0 && cardsWithData >= cards.length * 0.8;
            },
            { timeout: 20_000, polling: 500 }
          );
          break;
        } catch (e) {
          if (attempt === 3) {
            await logAsync(
              "warn",
              `Page ${currentPage}: Card data not fully loaded after 3 attempts, continuing anyway`
            );
          } else {
            await logAsync(
              "debug",
              `Page ${currentPage}: Attempt ${attempt} - waiting for card data...`
            );
            await wait(3000);
          }
        }
      }

      // Additional wait for dynamic content
      await wait(3000);

      // Extract cars from current page
      const carsOnPage = await page.evaluate((baseUrl) => {
        const results = [];
        const cards = document.querySelectorAll(".vlp-cards-base .cell.card");

        cards.forEach((card, index) => {
          try {
            // Get data attributes
            const inventoryId = card.dataset.inventoryitemid || "";
            const name = card.dataset.name || "";
            const price = card.dataset.price || "";
            const year = card.dataset.year || "";
            const make = card.dataset.make || "";
            const model = card.dataset.model || "";
            const trim = card.dataset.trim || "";
            const color = card.dataset.color || "";
            const transmission = card.dataset.transmission || "";
            const drivetrain = card.dataset.drivetrain || "";
            const engine = card.dataset.engine || "";
            const condition = card.dataset.condition || "";
            const vin = card.dataset.vin || "";
            const stockNumber = card.dataset.stocknumber || "";

            // Get mileage from the mileage tag
            const mileageEl = card.querySelector(".mileage-tag .body-2");
            const odometer = mileageEl ? mileageEl.textContent.trim() : "";

            // Get image
            const img = card.querySelector(".img-lazy-load");
            const image = img?.src || img?.dataset?.src || "";

            // Get link
            const linkEl = card.querySelector("a.img-lazy-load-container");
            const link = linkEl?.href ? new URL(linkEl.href, baseUrl).href : "";

            // Get price from pricing container if not in data attribute
            let finalPrice = price;
            if (!finalPrice) {
              const priceEl = card.querySelector(".price-info .value");
              finalPrice = priceEl ? priceEl.textContent.trim() : "";
            }

            // Only add if we have essential data
            if (inventoryId && name) {
              results.push({
                adId: inventoryId,
                title: name,
                price: finalPrice,
                image,
                odometer,
                link,
                dealer: "Yorkdale Volkswagen",
                isUsed: condition.toUpperCase() === "USED",
                proximity: "",
                color,
                transmission,
                drivetrain,
                engine,
                year,
                make,
                model,
                trim,
                vin,
                stockNumber,
              });
            }
          } catch (e) {
            console.warn(`Parse error on card ${index + 1}:`, e.message);
          }
        });

        return results;
      }, baseUrl);

      await logAsync(
        "info",
        `Extracted ${carsOnPage.length} cars from page ${currentPage}`
      );

      // Add only new cars (avoid duplicates)
      const existingIds = new Set(allCars.map((car) => car.adId));
      const newCars = carsOnPage.filter((car) => !existingIds.has(car.adId));

      allCars.push(...newCars);
      await logAsync(
        "info",
        `Added ${newCars.length} new cars. Total: ${allCars.length}/${totalResults}`
      );

      // -------------------------------------------------
      // 5. Navigate to next page if not last page
      // -------------------------------------------------
      if (currentPage < totalPages) {
        currentPage++;
        const currentUrl = page.url();
        const urlObj = new URL(currentUrl);

        // Add or update page parameter
        urlObj.searchParams.set("page", currentPage.toString());
        const nextPageUrl = urlObj.toString();

        await logAsync(
          "info",
          `Navigating to page ${currentPage}: ${nextPageUrl}`
        );

        try {
          // Navigate to next page
          await page.goto(nextPageUrl, {
            waitUntil: "domcontentloaded",
            timeout: 60_000,
          });

          // Wait for new content to load
          await wait(5000);

          // Wait for cards to appear
          await page.waitForSelector(".vlp-cards-base .cell.card", {
            timeout: 60_000,
          });

          // Verify new cards loaded
          const newCardCount = await page.evaluate(() => {
            return document.querySelectorAll(".vlp-cards-base .cell.card")
              .length;
          });

          if (newCardCount === 0) {
            await logAsync(
              "warn",
              `No cards found after navigating to page ${currentPage}`
            );
            break;
          }

          await logAsync(
            "info",
            `Page ${currentPage} loaded with ${newCardCount} cards`
          );
        } catch (e) {
          await logAsync("error", `Navigation failed for page ${currentPage}`, {
            error: e.message,
          });
          break;
        }
      } else {
        // Last page reached
        currentPage++;
        break;
      }
    }

    // -------------------------------------------------
    // 6. Return all results
    // -------------------------------------------------
    result.cars = allCars;
    result.total = allCars.length;

    await logAsync("success", "✅ YorkdaleVW scraping COMPLETE", {
      totalCars: result.total,
      expectedTotal: totalResults,
      pagesScraped: currentPage - 1,
      successRate: `${((result.total / totalResults) * 100).toFixed(1)}%`,
      finalUrl: page.url(),
    });

    // Warn if we didn't get all expected vehicles
    if (result.total < totalResults) {
      await logAsync(
        "warn",
        `⚠️ Scraped ${result.total} of ${totalResults} expected vehicles (${
          totalResults - result.total
        } missing)`
      );
    }

    return result;
  } catch (err) {
    // -------------------------------------------------
    // ERROR: Take screenshot + log full context
    // -------------------------------------------------
    await logAsync("error", "YorkdaleVW scraper FAILED - capturing state", {
      error: err.message,
      url: page.url(),
      stack: err.stack,
    });

    // Try to capture page state for debugging
    try {
      const pageState = await page.evaluate(() => {
        const resultsEl = document.querySelector(".results-cell .results");
        return {
          cardCount: document.querySelectorAll(".vlp-cards-base .cell.card")
            .length,
          hasCardsContainer: !!document.querySelector(".vlp-cards-base"),
          resultsText: resultsEl ? resultsEl.textContent.trim() : "N/A",
          url: window.location.href,
        };
      });
      await logAsync("info", "Page state at error", pageState);
    } catch (evalErr) {
      await logAsync("warn", "Could not capture page state", {
        error: evalErr.message,
      });
    }

    await page
      .screenshot({ path: "ERROR-yorkdale.png", fullPage: true })
      .catch(() => {});

    result.serverError = err.message;

    await logAsync("error", "YorkdaleVW scraper final error", {
      error: err.message,
      carsScrapedBeforeError: result.cars.length,
    });

    return result;
  }
};

module.exports = { scrapeYorkdaleVW };
