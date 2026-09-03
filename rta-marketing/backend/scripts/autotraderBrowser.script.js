(() => {
  console.clear();
  console.log(
    "%c[Scraper] AutoTrader Lazy-Image Fix v4",
    "color: limegreen; font-weight: bold;"
  );

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // 👇 Scroll step-by-step so all cards enter view
  const progressiveScroll = async (
    step = window.innerHeight * 0.8,
    pause = 800
  ) => {
    let lastY = 0;
    let currentY = 0;
    let retries = 0;
    const maxRetries = 5;

    while (true) {
      window.scrollBy(0, step);
      await delay(pause);

      currentY = window.scrollY;

      // Break condition: reached bottom
      if (currentY + window.innerHeight >= document.body.scrollHeight - 10) {
        retries++;
        if (retries >= maxRetries) break; // stop after several bottom passes
      } else {
        retries = 0;
      }

      lastY = currentY;
    }

    console.log("✅ Progressive scroll finished.");
    window.scrollTo(0, 0); // back to top
    await delay(1000);
  };

  const scrapeAutoTrader = async (baseUrl = window.location.origin) => {
    const result = [];

    console.log("ℹ️ Starting full scrape...");

    // Step 1. Wait for initial load
    for (let i = 0; i < 10; i++) {
      const cards = document.querySelectorAll(".result-item.enhanced");
      if (cards.length > 0) {
        console.log(`✅ Found ${cards.length} cards initially.`);
        break;
      }
      console.log("⏳ Waiting for cards...");
      await delay(1000);
    }

    // Step 2. Perform progressive scroll to trigger lazy images
    await progressiveScroll();

    // Step 3. Scrape all car cards
    const cards = document.querySelectorAll(".result-item.enhanced");
    console.log(`📦 Total cards in DOM: ${cards.length}`);

    cards.forEach((card) => {
      const adId = card.querySelector("[data-adid]")?.dataset.adid ?? null;
      const title =
        card
          .querySelector(".result-title, .title-with-trim")
          ?.innerText.trim() ?? "";
      const price = card.querySelector(".price-amount")?.innerText.trim() ?? "";

      // Get correct image: try src, data-src, or srcset
      const imgEl = card.querySelector(".main-photo img");
      const image =
        imgEl?.src ||
        imgEl?.getAttribute("data-src") ||
        imgEl?.getAttribute("srcset")?.split(" ")[0] ||
        "";

      const rawLink =
        Array.from(card.querySelectorAll("a.inner-link"))
          .map((a) => a.getAttribute("href"))
          .find((href) => href?.includes("/a/")) ?? "";
      const fullLink = rawLink ? new URL(rawLink, baseUrl).href : "";

      const proximity = Array.from(card.querySelectorAll(".proximity-text"))
        .map((t) => t.innerText.trim())
        .filter(Boolean)
        .join(" ");
      const odometer =
        card.querySelector(".odometer-proximity")?.innerText.trim() ?? "";
      const dealer = card.querySelector(".seller-name")?.innerText.trim() ?? "";

      const yearMatch = title.match(/^\d{4}/);
      const year = yearMatch ? +yearMatch[0] : null;
      const isUsed = year && year < new Date().getFullYear();

      result.push({
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

    console.table(result);
    console.log(`✅ Scraped ${result.length} cars successfully.`);
    return result;
  };

  scrapeAutoTrader(window.location.origin);
})();
