// scrapers/autotrader.scraper.js
const { logAsync } = require("../../utils/logger");

const scrapeAutoTrader = async (page, baseUrl) => {
  const result = { cars: [], total: 0, serverError: null };

  try {
    await logAsync("info", "Scraping AutoTrader (DOM version)", {
      url: page.url(),
    });

    // -------------------------------------------------
    // 1. Wait for initial load
    // -------------------------------------------------
    await page
      .waitForSelector(".result-item.enhanced, #titleCount", {
        timeout: 90_000,
      })
      .catch(() => {});

    // -------------------------------------------------
    // 2. ZERO-RESULT CHECK FIRST (instant return)
    // -------------------------------------------------
    const zeroResult = await page.evaluate(() => {
      // Check 1: Title count says "0"
      const countEl = document.querySelector("#titleCount");
      if (countEl && countEl.textContent.trim() === "0") return true;

      // Check 2: No car cards at all
      const cards = document.querySelectorAll(".result-item.enhanced");
      if (cards.length === 0) return true;

      return false;
    });

    if (zeroResult) {
      await logAsync("info", "Zero results detected (early exit)", {
        url: page.url(),
      });
      console.log("Zero results detected (early exit)");
      return { cars: [], total: 0, serverError: null };
    }

    // -------------------------------------------------
    // 3. Progressive scroll to load lazy images
    // -------------------------------------------------
    await page.evaluate(async () => {
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));

      const progressiveScroll = async (
        step = window.innerHeight * 0.8,
        pause = 1500
      ) => {
        let retries = 0;
        const maxRetries = 5;
        while (true) {
          window.scrollBy(0, step);
          await delay(pause);
          const atBottom =
            window.scrollY + window.innerHeight >=
            document.body.scrollHeight - 10;
          if (atBottom) {
            retries++;
            if (retries >= maxRetries) break;
          } else {
            retries = 0;
          }
        }
        window.scrollTo(0, 0);
        await delay(1000);
      };

      await progressiveScroll();
    });

    // -------------------------------------------------
    // 4. DOM extraction (with retry loop)
    // -------------------------------------------------
    const cars = await page.evaluate((baseUrl) => {
      const out = [];

      let attempts = 0;
      const maxAttempts = 4;
      while (attempts < maxAttempts) {
        const cards = document.querySelectorAll(".result-item.enhanced");
        if (cards.length) {
          cards.forEach((card) => {
            const adId =
              card.querySelector("[data-adid]")?.dataset.adid ?? null;
            const title =
              card
                .querySelector(".result-title, .title-with-trim")
                ?.innerText.trim() ?? "";
            const price =
              card.querySelector(".price-amount")?.innerText.trim() ?? "";

            // ---- IMAGE: always string ----
            const imgEl = card.querySelector(".main-photo img");
            let image = "";
            if (imgEl) {
              if (imgEl.src && imgEl.src.startsWith("http")) {
                image = imgEl.src;
              } else if (
                imgEl.dataset.src &&
                imgEl.dataset.src.startsWith("http")
              ) {
                image = imgEl.dataset.src;
              } else if (imgEl.srcset) {
                const parts = imgEl.srcset
                  .split(",")
                  .map((s) => s.trim().split(" ")[0]);
                const validSrc = parts.find(
                  (src) => src && src.startsWith("http")
                );
                if (validSrc) image = validSrc;
              }
            }

            const rawLink =
              Array.from(card.querySelectorAll("a.inner-link"))
                .map((a) => a.getAttribute("href"))
                .find((h) => h?.includes("/a/")) ?? "";

            const fullLink = rawLink ? new URL(rawLink, baseUrl).href : "";

            const proximity = Array.from(
              card.querySelectorAll(".proximity-text")
            )
              .map((t) => t.innerText.trim())
              .filter(Boolean)
              .join(" ");

            const odometer =
              card.querySelector(".odometer-proximity")?.innerText.trim() ?? "";
            const dealer =
              card.querySelector(".seller-name")?.innerText.trim() ?? "";

            const yearMatch = title.match(/^\d{4}/);
            const year = yearMatch ? +yearMatch[0] : null;
            const isUsed = year && year < new Date().getFullYear();

            out.push({
              adId,
              title,
              price,
              image,
              proximity,
              odometer,
              link: fullLink,
              dealer,
              isUsed,
            });
          });
          break;
        }

        const syncDelay = (ms) => {
          const start = Date.now();
          while (Date.now() - start < ms) {}
        };
        syncDelay(800);
        attempts++;
      }
      return out;
    }, baseUrl);

    result.cars = cars;
    result.total = cars.length;

    await logAsync("success", "AutoTrader scraping complete", {
      totalCars: result.total,
    });

    return result;
  } catch (err) {
    result.serverError = err.message;
    await logAsync("error", "AutoTrader scraper failed", {
      error: err.message,
    });
    return result;
  }
};

module.exports = { scrapeAutoTrader };
