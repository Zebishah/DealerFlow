const { logAsync } = require("../../utils/logger");

/**
 * Optimized AutoPlanet scraper with robust handling of slow-loading pages
 */
const scrapeAutoPlanet = async (page, baseUrl) => {
  const result = { cars: [], total: 0, serverError: null };
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    await logAsync("info", "Navigating to AutoPlanet search page...", {
      baseUrl,
    });

    // Load page
    await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 60_000 });
    await logAsync("info", "Page loaded, waiting for vehicle cards...", {
      url: page.url(),
    });
    // -----------------------------
    // 🔍 Wait for Results Heading to Appear
    // -----------------------------
    await page.waitForSelector(
      ".srp__vehicle-count, .advanced-filters-wrap__heading-custom h1",
      { timeout: 30000 }
    );

    // Then check if it says "0 Items Matching" or "No Results"
    const isZeroResults = await page.evaluate(() => {
      const heading = document.querySelector(
        ".srp__vehicle-count, .advanced-filters-wrap__heading-custom h1"
      );
      if (!heading) return false;
      const text = heading.textContent.trim();
      return (
        text.includes("0 Items Matching") ||
        text.toLowerCase().includes("no results")
      );
    });

    if (isZeroResults) {
      await logAsync(
        "info",
        "Detected 'No Results' or '0 Items Matching' — exiting early"
      );
      return result; // { cars: [], total: 0, serverError: null }
    }
    // -----------------------------
    // Wait for initial cards with retries
    // -----------------------------
    let initialCount = 0;
    const maxRetries = 15;
    let retry = 0;

    while (retry < maxRetries) {
      initialCount = await page.evaluate(
        () => document.querySelectorAll(".vehicle-card").length
      );
      if (initialCount > 0) break;
      retry++;
      await delay(1000); // wait 1s before retrying
    }

    if (initialCount === 0) {
      await logAsync(
        "warn",
        "No vehicle cards found after retries. Checking for empty state..."
      );
      const noResults = await page.$(".no-results, .empty-state");
      if (noResults) return result; // Return empty result gracefully
      // else continue and try lazy loading anyway
    }

    await logAsync(
      "info",
      `Initial cards detected: ${initialCount}. Starting lazy load...`
    );

    // -----------------------------
    // Lazy load / scroll all vehicles
    // -----------------------------
    await page.evaluate(async () => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      let lastCount = 0;
      let noChangeCount = 0;

      while (noChangeCount < 3) {
        window.scrollBy(0, window.innerHeight * 2); // scroll 2 viewports at a time
        await delay(800);

        const currentCount = document.querySelectorAll(".vehicle-card").length;
        if (currentCount === lastCount) {
          noChangeCount++;
        } else {
          noChangeCount = 0;
          lastCount = currentCount;
        }
      }
      window.scrollTo(0, 0); // scroll back to top
      await delay(500);
    });

    await logAsync("info", "All vehicles loaded. Extracting data...");

    // -----------------------------
    // Extract vehicle info
    // -----------------------------
    const cars = await page.evaluate(() => {
      const out = [];
      const cards = document.querySelectorAll(".vehicle-card");

      cards.forEach((card) => {
        const title =
          card.querySelector(".vehicle-card__title")?.innerText.trim() || "";
        const price =
          card
            .querySelector('[convertus-data-id="srp__dealer-price"]')
            ?.innerText.trim() || "";
        const link =
          card.querySelector("a.vehicle-card__image-link")?.href || "";
        const image = card.querySelector(".vehicle-card__image")?.src || "";
        const stock =
          card
            .querySelector(".vehicle-card__stock")
            ?.innerText.replace("Stock #:", "")
            .trim() || "";
        const location =
          card
            .querySelector(".vehicle-card__location")
            ?.innerText.replace("This vehicle is located in", "")
            .trim() || "";
        const odometer =
          card
            .querySelector('[data-spec="odometer"] .detailed-specs__value')
            ?.innerText.trim() || "";
        const year = card.dataset.vehicleYear || "";
        const make = card.dataset.vehicleMake || "";
        const model = card.dataset.vehicleModel || "";
        const trim = card.dataset.vehicleTrim || "";
        const colour = card.dataset.vehicleColour || "";
        const vin = card.dataset.vehicleVin || "";
        const carfaxVin = card.querySelector(".carfax a p")?.dataset.vin || "";
        const finance =
          card
            .querySelector(".price-block__single--finance .df.aifs")
            ?.innerText.trim() || "";
        const financeTerm =
          card.querySelector(".price-block__sub")?.innerText.trim() || "";

        out.push({
          title,
          year,
          make,
          model,
          trim,
          colour,
          vin,
          stock,
          price,
          finance,
          financeTerm,
          odometer,
          location,
          link,
          image,
          carfax: carfaxVin,
        });
      });

      return out;
    });

    // -----------------------------
    // Extract total count
    // -----------------------------
    const totalCount = await page.evaluate(() => {
      const el = document.querySelector(".inventory-listing__header-count");
      if (!el) return 0;
      const match = el.innerText.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });

    result.cars = cars;
    result.total = totalCount || cars.length;

    await logAsync("success", "AutoPlanet scraping complete", {
      totalCars: result.total,
      carsScraped: cars.length,
    });

    return result;
  } catch (err) {
    result.serverError = err.message;
    await logAsync("error", "AutoPlanet scraper failed", {
      error: err.message,
    });
    return result;
  }
};

module.exports = { scrapeAutoPlanet };
