// services/scrapers/humberview.scraper.js
const { logAsync } = require("../../utils/logger");

// Helper function to wait (replacement for page.waitForTimeout)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scrapeHumberview = async (page, baseUrl) => {
  const result = { cars: [], total: 0, serverError: null };

  try {
    await logAsync("info", "START: HumberviewVW scraper", { url: page.url() });

    // -------------------------------------------------
    // 1. Wait for initial load (counter or cards)
    // -------------------------------------------------
    try {
      await page.waitForSelector(".il-totalVehicles__count, article.vc-alpha", {
        timeout: 90_000,
      });
    } catch (e) {
      await logAsync("error", "Initial load timeout", { error: e.message });
      throw new Error("Initial load timeout – no counter or cards found");
    }

    // Increased wait for JS to finish rendering
    await wait(5000);

    // -------------------------------------------------
    // 2. Read total count
    // -------------------------------------------------
    const initialCount = await page.evaluate(() => {
      const el = document.querySelector(".il-totalVehicles__count");
      return el ? parseInt(el.textContent.trim(), 10) : 0;
    });

    if (initialCount === 0) {
      await logAsync("info", "Zero results detected on first load");
      return { cars: [], total: 0, serverError: null };
    }

    // -------------------------------------------------
    // 3. Determine items per page and calculate total pages
    // -------------------------------------------------
    try {
      await page.waitForSelector("article.vc-alpha", { timeout: 90_000 });
    } catch (e) {
      await logAsync("error", "No car cards found", { error: e.message });
      throw new Error("No car cards found after waiting");
    }

    // await wait(3000);
    // const pageHeading = await page.evaluate(() => {
    //   const headingEl = document.querySelector(
    //     ".il-heading.il-heading1.heading1"
    //   );
    //   const searchInput = document.querySelector(
    //     ".uk-form-item.uk-input.has-icon.is-clearable.il-filterSearch__input input.uk-inputtable"
    //   );

    //   const heading = headingEl ? headingEl.textContent.trim() : "";
    //   const searchValue = searchInput ? searchInput.value.trim() : "";

    //   return { heading, searchValue };
    // });

    // const { heading, searchValue } = pageHeading;

    // ✅ NEW: Detect if any filter tags are visible (search, price, odometer, etc.)
    const filtersApplied = await page.evaluate(() => {
      return !!document.querySelector(
        ".il-filtersReset.il-listingAlpha__filtersReset"
      );
    });

    if (!filtersApplied) {
      // Now we can safely decide: truly generic results, not filtered
      await logAsync(
        "info",
        "No filters applied — likely a generic results page",
        {
          heading,
          searchValue,
        }
      );
      return { cars: [], total: 0, serverError: null };
    }

    // const isGenericResults = heading.includes(
    //   "New & Used SUVs, Trucks, Cars for Sale"
    // );

    // // 🧠 If heading is generic AND search bar is empty => return empty results
    // if (isGenericResults && !searchValue) {
    //   await logAsync(
    //     "info",
    //     "Generic results detected - filters did not match (and search bar empty)",
    //     {
    //       heading,
    //       searchValue,
    //     }
    //   );
    //   return { cars: [], total: 0, serverError: null };
    // }
    // Check how many cards we actually have on first page
    const cardsPerPage = await page.evaluate(() => {
      return document.querySelectorAll("article.vc-alpha").length;
    });

    // FIXED: Calculate total pages based on vehicle count and cards per page
    const totalPages = Math.ceil(initialCount / cardsPerPage);

    const allCars = [];
    let consecutiveEmptyPages = 0;
    const MAX_EMPTY_PAGES = 2; // Stop if we hit 2 empty pages in a row

    // -------------------------------------------------
    // 4. Loop through all pages
    // -------------------------------------------------
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      // Wait for cards to be visible
      try {
        await page.waitForSelector("article.vc-alpha", { timeout: 90_000 });
        consecutiveEmptyPages = 0; // Reset counter when cards found
      } catch (e) {
        consecutiveEmptyPages++;
        await logAsync("error", `No cards found on page ${currentPage}`, {
          error: e.message,
          consecutiveEmptyPages,
        });

        if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
          break;
        }
        continue; // Try next page
      }

      // Wait for content to stabilize with multiple checks

      // Wait for cards to have JSON-LD data - with retries
      let jsonLdReady = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.waitForFunction(
            () => {
              const cards = document.querySelectorAll("article.vc-alpha");
              const cardsWithJsonLd = Array.from(cards).filter((card) =>
                card.querySelector('script[type="application/ld+json"]')
              ).length;
              // Accept if at least 50% of cards have JSON-LD data
              return cards.length > 0 && cardsWithJsonLd >= cards.length * 0.5;
            },
            { timeout: 20_000, polling: 500 }
          );
          jsonLdReady = true;
          break;
        } catch (e) {
          if (attempt === 3) {
            await logAsync(
              "warn",
              `Page ${currentPage}: JSON-LD data not fully loaded after 3 attempts, continuing anyway`
            );
          } else {
            await logAsync(
              "debug",
              `Page ${currentPage}: Attempt ${attempt} - waiting longer for JSON-LD...`
            );
            await wait(3000);
          }
        }
      }

      // Additional wait to ensure all dynamic content is loaded
      await wait(3000);

      // Extract cars from current page
      const carsOnPage = await page.evaluate((baseUrl) => {
        const results = [];
        const cards = document.querySelectorAll("article.vc-alpha");

        cards.forEach((card, index) => {
          try {
            const jsonEl = card.querySelector(
              'script[type="application/ld+json"]'
            );
            if (!jsonEl || !jsonEl.textContent) {
              console.warn(`Card ${index + 1}: No JSON-LD data found`);
              return;
            }

            const d = JSON.parse(jsonEl.textContent.trim());

            const img = card.querySelector(".vc-vehicleImage img");
            const image = img?.src?.includes("http")
              ? img.src
              : img?.dataset?.src || d.image || "";

            results.push({
              adId: d.sku || null,
              title: d.name || "",
              price: d.offers?.price
                ? `$${Number(d.offers.price).toLocaleString()}`
                : "",
              image,
              odometer: d.mileageFromOdometer?.value
                ? `${Number(d.mileageFromOdometer.value).toLocaleString()} KM`
                : "",
              link: d.offers?.url ? new URL(d.offers.url, baseUrl).href : "",
              dealer: d.manufacturer?.name || "Humberview Group",
              isUsed: true,
              proximity: "",
              color: d.color?.name || "",
              transmission: d.vehicleTransmission?.name || "",
              drivetrain: d.driveWheelConfiguration?.name || "",
              engine: d.vehicleEngine?.description || "",
            });
          } catch (e) {
            console.warn(`Parse error on card ${index + 1}:`, e.message);
          }
        });

        return results;
      }, baseUrl);

      if (carsOnPage.length === 0) {
        consecutiveEmptyPages++;

        if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
          await logAsync(
            "error",
            `No cars found on ${MAX_EMPTY_PAGES} consecutive pages, stopping`
          );
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        allCars.push(...carsOnPage);
      }

      // Stop early if we've reached the expected total
      if (allCars.length >= initialCount) {
        await logAsync(
          "success",
          `Reached expected total of ${initialCount} vehicles, stopping pagination`
        );
        break;
      }

      // -------------------------------------------------
      // 5. Navigate to next page (if not last page)
      // -------------------------------------------------
      if (currentPage < totalPages) {
        // Store current URL to verify navigation
        const beforeUrl = page.url();

        // IMPROVED: Try multiple methods to navigate to next page
        const navigated = await page.evaluate((nextPageNum) => {
          // Method 1: Find exact page number button
          const paginationItems = Array.from(
            document.querySelectorAll(
              ".il-paginationItem:not(.il-paginationItem__arrow)"
            )
          );

          const nextBtn = paginationItems.find((btn) => {
            const text = btn.textContent.trim();
            const match = text.match(/\d+/);
            const pageNum = match ? parseInt(match[0]) : null;
            return pageNum === nextPageNum;
          });

          if (
            nextBtn &&
            !nextBtn.disabled &&
            !nextBtn.classList.contains("-disabled")
          ) {
            console.log(`Clicking page button ${nextPageNum}`);
            nextBtn.click();
            return true;
          }

          // Method 2: Click the "next arrow" button
          const nextArrowBtn = document.querySelector(
            ".il-paginationItem__arrow:not(.-disabled)"
          );

          if (nextArrowBtn) {
            const svg = nextArrowBtn.querySelector(
              'svg[xlink\\:href="#arrow-right"]'
            );
            if (svg) {
              console.log("Clicking next arrow button");
              nextArrowBtn.click();
              return true;
            }
          }

          // Method 3: Try any enabled next button
          const allArrows = document.querySelectorAll(
            ".il-paginationItem__arrow"
          );
          for (const arrow of allArrows) {
            if (
              !arrow.classList.contains("-disabled") &&
              arrow.querySelector('svg[xlink\\:href="#arrow-right"]')
            ) {
              console.log("Clicking fallback next arrow");
              arrow.click();
              return true;
            }
          }

          console.warn("No navigation button found");
          return false;
        }, currentPage + 1);

        if (!navigated) {
          await logAsync(
            "error",
            `Could not find next page button for page ${
              currentPage + 1
            }, stopping pagination`
          );
          break;
        }

        // Wait for navigation to complete
        try {
          await page.waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: 90_000,
          });
        } catch (e) {
          await logAsync(
            "warn",
            `Navigation timeout for page ${currentPage + 1}: ${e.message}`
          );

          // Check if URL actually changed despite timeout
          const afterUrl = page.url();
          if (afterUrl === beforeUrl) {
            await logAsync("error", "URL did not change, stopping pagination");
            break;
          }
        }

        // Wait for new page to stabilize
        await wait(5000);

        // Verify we're on the new page
        const currentUrl = page.url();

        // Additional verification: wait for new content to load
        try {
          await page.waitForSelector("article.vc-alpha", { timeout: 90_000 });

          const newCardCount = await page.evaluate(() => {
            return document.querySelectorAll("article.vc-alpha").length;
          });

          if (newCardCount === 0) {
            await logAsync(
              "warn",
              `No cards found after navigating to page ${currentPage + 1}`
            );
          } else {
          }
        } catch (e) {
          await logAsync(
            "warn",
            `Could not verify cards on page ${currentPage + 1}`
          );
        }
      }
    }

    // -------------------------------------------------
    // 6. Return all results
    // -------------------------------------------------
    result.cars = allCars;
    result.total = allCars.length;

    await logAsync("success", "✅ HumberviewVW scraping COMPLETE", {
      totalCars: result.total,
      expectedTotal: initialCount,
      pagesScraped: Math.min(currentPage, totalPages),
      successRate: `${((result.total / initialCount) * 100).toFixed(1)}%`,
      finalUrl: page.url(),
    });

    // Warn if we didn't get all expected vehicles
    if (result.total < initialCount) {
      await logAsync(
        "warn",
        `⚠️ Scraped ${result.total} of ${initialCount} expected vehicles (${
          initialCount - result.total
        } missing)`
      );
    }

    return result;
  } catch (err) {
    // -------------------------------------------------
    // ERROR: Take screenshot + log full context
    // -------------------------------------------------
    await logAsync("error", "HumberviewVW scraper FAILED - capturing state", {
      error: err.message,
      url: page.url(),
      stack: err.stack,
    });

    // Try to capture page state for debugging
    try {
      const pageState = await page.evaluate(() => {
        return {
          cardCount: document.querySelectorAll("article.vc-alpha").length,
          hasCounter: !!document.querySelector(".il-totalVehicles__count"),
          counterText:
            document.querySelector(".il-totalVehicles__count")?.textContent ||
            "N/A",
          hasPagination: !!document.querySelector(".il-paginationItem"),
          paginationHTML:
            document
              .querySelector(".il-paginationItem")
              ?.outerHTML?.substring(0, 200) || "N/A",
          url: window.location.href,
        };
      });
    } catch (evalErr) {
      await logAsync("warn", "Could not capture page state", {
        error: evalErr.message,
      });
    }

    await page
      .screenshot({ path: "ERROR-humberview.png", fullPage: true })
      .catch(() => {});

    result.serverError = err.message;

    await logAsync("error", "HumberviewVW scraper final error", {
      error: err.message,
      carsScrapedBeforeError: result.cars.length,
    });

    return result;
  }
};

module.exports = { scrapeHumberview };
